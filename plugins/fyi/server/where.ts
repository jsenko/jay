/**
 * Field filters for search.
 *
 * One generic `where` instead of a search option per field. The set of
 * operators is kept to what a real query engine can serve — equality,
 * membership, substring, range, presence — so it would survive moving
 * the store onto a database.
 *
 * | Value | Matches when |
 * |---|---|
 * | `"x"` | the field equals it |
 * | `["x", "y"]` | the field equals any of them |
 * | `{contains: "x"}` | a string field holds it, ignoring case |
 * | `{all: ["x", "y"]}` | a list field holds every one |
 * | `{before, after}` | inside the range, inclusive — dates or numbers |
 * | `{exists: true}` | the field is present (`false`: absent) |
 *
 * A path may be dotted, `attention_items.type`, and a list anywhere on
 * it matches when any element does.
 */

import { ToolError } from "./errors.js";
import { segments, valuesAt } from "./fieldpath.js";
import { SCHEMAS, enumsByType, type FieldSchema } from "./schema.js";
import { ITEM_TYPES, type Item, type ItemType } from "./types.js";

/** A field path mapped to the condition it must meet. */
export type Where = Record<string, unknown>;

const OPERATORS = ["contains", "all", "before", "after", "exists"] as const;

/** Values compare as text, so `9657` and `"9657"` are the same number. */
function same(a: unknown, b: unknown): boolean {
  return String(a) === String(b);
}

/** A plain date, as a range bound is usually written. */
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Orders a value against a bound: numerically when both are numbers, else
 * as text. Against a plain date a timestamp compares on its day, so a date
 * bound takes in the whole day, as an inclusive range promises.
 */
function compare(value: unknown, bound: unknown): number {
  const x = Number(value);
  const y = Number(bound);
  if (!Number.isNaN(x) && !Number.isNaN(y) && typeof value !== "boolean") return x - y;
  const day = typeof bound === "string" && DATE.test(bound) && typeof value === "string" ? value.slice(0, 10) : value;
  return String(day).localeCompare(String(bound));
}

/** Whether the values found at a path satisfy one condition. */
function satisfies(values: unknown[], condition: unknown): boolean {
  if (Array.isArray(condition)) return values.some((v) => condition.some((c) => same(v, c)));
  if (typeof condition !== "object" || condition === null) return values.some((v) => same(v, condition));

  const ops = condition as Record<string, unknown>;
  if (ops.exists !== undefined && (values.length > 0) !== ops.exists) return false;
  if (ops.contains !== undefined) {
    const needle = String(ops.contains).toLowerCase();
    if (!values.some((v) => typeof v === "string" && v.toLowerCase().includes(needle))) return false;
  }
  if (ops.all !== undefined && !(ops.all as unknown[]).every((c) => values.some((v) => same(v, c)))) return false;
  if (ops.after !== undefined && !values.some((v) => compare(v, ops.after) >= 0)) return false;
  if (ops.before !== undefined && !values.some((v) => compare(v, ops.before) <= 0)) return false;
  return true;
}

/** Whether an item meets every condition. Conditions combine with AND. */
export function matchesWhere(item: Item, where: Where): boolean {
  return Object.entries(where).every(([path, condition]) => satisfies(valuesAt(item, segments(path)), condition));
}

/** The schema at a dotted path for one type, or undefined when there is none. */
function fieldAt(type: ItemType, path: string[]): FieldSchema | undefined {
  let field: FieldSchema | undefined = SCHEMAS[type].properties[path[0]];
  for (const key of path.slice(1)) {
    while (field?.items) field = field.items;
    field = field?.properties?.[key];
  }
  return field;
}

/**
 * Refuses a path no searched type has, and a malformed operator. A typo
 * must fail loudly: an unknown field would otherwise match nothing, and
 * "no results" reads as an answer.
 */
export function validateWhere(where: unknown, types: readonly ItemType[] = ITEM_TYPES): Where {
  if (typeof where !== "object" || where === null || Array.isArray(where)) {
    throw new ToolError("where must be an object of field: condition");
  }

  for (const [path, condition] of Object.entries(where)) {
    if (!types.some((type) => fieldAt(type, segments(path)))) {
      throw new ToolError(`where: "${path}" is not a field on ${types.join(" or ")}`);
    }
    if (typeof condition !== "object" || condition === null || Array.isArray(condition)) continue;

    for (const [op, value] of Object.entries(condition)) {
      if (!(OPERATORS as readonly string[]).includes(op)) {
        throw new ToolError(`where.${path}: unknown operator "${op}"; use ${OPERATORS.join(", ")}, a value, or a list of values`);
      }
      if (op === "all" && !Array.isArray(value)) throw new ToolError(`where.${path}.all must be a list`);
      if (op === "exists" && typeof value !== "boolean") throw new ToolError(`where.${path}.exists must be true or false`);
    }
  }
  return where as Where;
}

/** A short hint of what a field holds, for the tool definition. */
function hint(field: FieldSchema): string {
  if (field.enum) return `one of: ${field.enum.join(", ")}`;
  if (field.format) return field.format;
  if (field.type === "array") return `list of ${field.items?.type ?? "values"}`;
  return field.type;
}

/** Every searchable path for a type: fields, and fields of listed or nested objects. */
function pathsOf(type: ItemType): [string, FieldSchema][] {
  const out: [string, FieldSchema][] = [];
  const walk = (prefix: string, field: FieldSchema) => {
    out.push([prefix, field]);
    let inner = field;
    while (inner.items) inner = inner.items;
    for (const [key, sub] of Object.entries(inner.properties ?? {})) walk(`${prefix}.${key}`, sub);
  };
  for (const [name, field] of Object.entries(SCHEMAS[type].properties)) walk(name, field);
  return out;
}

/**
 * The `where` input as the model sees it: every path, annotated with the
 * types that have it and what it holds, so field names are read rather
 * than guessed. Values are left untyped because each may be a value, a
 * list, or an operator object.
 */
export function whereInputSchema(): Record<string, unknown> {
  const owners = new Map<string, [ItemType, FieldSchema][]>();
  for (const type of ITEM_TYPES) {
    for (const [path, field] of pathsOf(type)) {
      owners.set(path, [...(owners.get(path) ?? []), [type, field]]);
    }
  }

  const properties = Object.fromEntries(
    [...owners].map(([path, fields]) => {
      const types = fields.map(([type]) => type);
      const scope = types.length < ITEM_TYPES.length ? `(${types.join(", ")}) ` : "";
      const perType = enumsByType(fields);
      return [path, { description: `${scope}${perType ? `one of, by type: ${perType}` : hint(fields[0][1])}` }];
    })
  );

  return {
    type: "object",
    description:
      'Field conditions, combined with AND. A value means equals; a list means any of; or an object of {contains: "text"}, {all: [...]}, {before, after}, {exists: true}. Dotted paths reach into lists: "attention_items.type": "decide".',
    properties,
  };
}
