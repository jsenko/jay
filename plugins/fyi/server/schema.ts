/**
 * Schema loading, validation, and MCP tool-input generation.
 *
 * The files in `schemas/` are the single source of truth: the server
 * validates against them and the tool definitions the model sees are
 * generated from them, so the two cannot drift.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ToolError } from "./errors.js";
import { ITEM_TYPES, type ItemType } from "./types.js";

const SCHEMA_DIR = join(dirname(fileURLToPath(import.meta.url)), "schemas");

/** The subset of JSON Schema these files may use. See SPEC.md §2. */
export interface FieldSchema {
  type: "string" | "number" | "integer" | "boolean" | "array" | "object";
  description?: string;
  enum?: string[];
  format?: "date" | "date-time";
  pattern?: string;
  default?: unknown;
  items?: FieldSchema;
  properties?: Record<string, FieldSchema>;
  required?: string[];
  /** The field holds another item's id: of this type, or `any`. */
  "x-fyi-ref"?: string;
}

/** A loaded type schema, with common fields already merged in. */
export interface TypeSchema {
  type: ItemType;
  title: string;
  properties: Record<string, FieldSchema>;
  required: string[];
  /**
   * The field naming the external thing a mirrored item stands for, from
   * `x-fyi-key`. Its value decides the item's id and refuses duplicates.
   */
  key?: string;
}

function load(name: string): any {
  return JSON.parse(readFileSync(join(SCHEMA_DIR, `${name}.json`), "utf8"));
}

const common = load("common");

/**
 * Every type schema, keyed by type, with `common.json` merged in.
 *
 * Merging rather than inheritance: there is one shared fragment and one
 * level, which is all the model needs.
 */
export const SCHEMAS: Record<ItemType, TypeSchema> = Object.fromEntries(
  ITEM_TYPES.map((type) => {
    const own = load(type);
    return [
      type,
      {
        type,
        title: own.title,
        properties: { ...common.properties, ...own.properties },
        required: [...(common.required ?? []), ...(own.required ?? [])],
        key: own["x-fyi-key"],
      },
    ];
  })
) as Record<ItemType, TypeSchema>;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Validates one field, returning an error message or null. */
function checkField(name: string, schema: FieldSchema, value: unknown): string | null {
  if (schema.enum && !schema.enum.includes(value as string)) {
    return `${name} must be one of: ${schema.enum.join(", ")}`;
  }

  switch (schema.type) {
    case "string":
      if (typeof value !== "string") return `${name} must be a string`;
      if (schema.format === "date" && !DATE_ONLY.test(value)) {
        return `${name} must be a date as YYYY-MM-DD`;
      }
      if (schema.format === "date-time" && Number.isNaN(Date.parse(value))) {
        return `${name} must be an ISO 8601 timestamp`;
      }
      if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
        return `${name} must match ${schema.pattern}`;
      }
      return null;

    case "integer":
      if (!Number.isInteger(value)) return `${name} must be a whole number`;
      return null;

    case "number":
      if (typeof value !== "number") return `${name} must be a number`;
      return null;

    case "boolean":
      if (typeof value !== "boolean") return `${name} must be true or false`;
      return null;

    case "array": {
      if (!Array.isArray(value)) return `${name} must be an array`;
      if (!schema.items) return null;
      for (const [i, entry] of value.entries()) {
        const err = checkField(`${name}[${i}]`, schema.items, entry);
        if (err) return err;
      }
      return null;
    }

    case "object": {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return `${name} must be an object`;
      }
      const obj = value as Record<string, unknown>;
      for (const req of schema.required ?? []) {
        if (obj[req] === undefined) return `${name}.${req} is required`;
      }
      for (const [key, entry] of Object.entries(obj)) {
        const sub = schema.properties?.[key];
        if (!sub) return `${name}.${key} is not a known field`;
        const err = checkField(`${name}.${key}`, sub, entry);
        if (err) return err;
      }
      return null;
    }

    default:
      return `${name} has an unsupported schema type`;
  }
}

/**
 * Everything wrong with a set of fields, against a type's schema.
 *
 * `partial` skips the required check, for updates that touch only some
 * fields. Unknown fields are always reported — silently accepting one
 * means a typo is written to disk and never queried again.
 */
export function problems(
  type: ItemType,
  fields: Record<string, unknown>,
  { partial = false } = {}
): string[] {
  const schema = SCHEMAS[type];
  const out: string[] = [];

  for (const [name, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    const field = schema.properties[name];
    if (!field) {
      const known = Object.keys(schema.properties).sort().join(", ");
      out.push(`"${name}" is not a field on ${type}. Known fields: ${known}`);
      continue;
    }
    const err = checkField(name, field, value);
    if (err) out.push(err);
  }

  if (partial) return out;

  for (const name of schema.required) {
    if (fields[name] === undefined) {
      out.push(
        name === "next_action_at"
          ? "next_action_at is required on a task: give the date you want to look at this again. If there is no next action, capture it as a note instead."
          : `${name} is required on ${type}`
      );
    }
  }
  return out;
}

/** Throws the first problem with a set of fields, for tools refusing a write. */
export function validate(
  type: ItemType,
  fields: Record<string, unknown>,
  options: { partial?: boolean } = {}
): void {
  const [first] = problems(type, fields, options);
  if (first) throw new ToolError(first);
}

/** Fields a caller supplies, as opposed to ones the server maintains. */
const SERVER_OWNED = new Set(["id", "type", "created_at", "updated_at"]);

/**
 * Generates an MCP tool input schema for one item type.
 *
 * This is what removes the need for any document describing the format:
 * the model reads the fields off the tool definition it already receives.
 */
export function toolPropertiesFor(type: ItemType): Record<string, unknown> {
  const { properties } = SCHEMAS[type];
  return Object.fromEntries(
    Object.entries(properties)
      .filter(([name]) => !SERVER_OWNED.has(name))
      .map(([name, field]) => [name, toolField(field)])
  );
}

/** Strips custom keywords MCP clients would not understand. */
function toolField(field: FieldSchema): Record<string, unknown> {
  const out: Record<string, unknown> = { type: field.type };
  if (field.description) out.description = field.description;
  if (field.enum) out.enum = field.enum;
  if (field.items) out.items = toolField(field.items);
  if (field.properties) {
    out.properties = Object.fromEntries(
      Object.entries(field.properties).map(([k, v]) => [k, toolField(v)])
    );
    if (field.required) out.required = field.required;
  }
  if (field.format === "date") {
    out.description = `${out.description ?? ""} Format: YYYY-MM-DD.`.trim();
  }
  return out;
}

/** Required fields a caller must supply for a type. */
export function requiredFor(type: ItemType): string[] {
  return SCHEMAS[type].required.filter((name) => !SERVER_OWNED.has(name));
}

/**
 * Properties for a tool that accepts any item type.
 *
 * The union of every type's fields, with type-specific ones annotated so
 * the model can tell which apply where. Per-type `required` cannot be
 * expressed in one schema, so the server enforces it and returns an
 * error saying what is missing.
 */
export function unionProperties(): Record<string, unknown> {
  const owners = new Map<string, ItemType[]>();

  for (const type of ITEM_TYPES) {
    for (const name of Object.keys(SCHEMAS[type].properties)) {
      if (SERVER_OWNED.has(name)) continue;
      owners.set(name, [...(owners.get(name) ?? []), type]);
    }
  }

  const out: Record<string, unknown> = {};
  for (const [name, types] of owners) {
    const fields = types.map((type) => [type, SCHEMAS[type].properties[name]] as const);
    const schema = toolField(fields[0][1]) as Record<string, unknown>;
    if (types.length < ITEM_TYPES.length) {
      const scope = types.join(", ");
      schema.description = `(${scope}) ${schema.description ?? ""}`.trim();
    }
    const perType = enumsByType(fields);
    if (perType) {
      schema.enum = [...new Set(fields.flatMap(([, f]) => f.enum ?? []))];
      schema.description = `${schema.description ?? ""} Values by type: ${perType}.`.trim();
    }
    out[name] = schema;
  }
  return out;
}

/**
 * The allowed values of a shared field, type by type — or null when every
 * type allows the same ones.
 *
 * A tool taking any type shows one schema per field, and showing only the
 * first type's values sends the model to try a task's status on a project.
 */
export function enumsByType(fields: readonly (readonly [ItemType, FieldSchema])[]): string | null {
  const lists = fields.map(([, field]) => field.enum?.join(", ") ?? "any");
  if (new Set(lists).size < 2) return null;
  return fields.map(([type], i) => `${type}: ${lists[i]}`).join("; ");
}

/**
 * Fills in declared defaults for fields the caller left out.
 *
 * A default declared in a schema has to actually take effect, or a
 * search for `status: active` silently misses every item that never
 * stated its status.
 */
export function applyDefaults(type: ItemType, fields: Record<string, unknown>): void {
  for (const [name, field] of Object.entries(SCHEMAS[type].properties)) {
    if (field.default !== undefined && fields[name] === undefined) {
      fields[name] = field.default;
    }
  }
}
