/**
 * References between items, declared with `x-fyi-ref`.
 *
 * A field that holds another item's id is only useful while that id
 * resolves. Checking at write time turns `project: "project-gitopz"` into
 * an error naming the typo, instead of a note that silently belongs to
 * nothing and never shows up in that project's handoff.
 */

import { ToolError } from "./errors.js";
import { replaceAt, segments, valuesAt } from "./fieldpath.js";
import { SCHEMAS, type FieldSchema } from "./schema.js";
import { all, get, write } from "./store.js";
import { ITEM_TYPES, type ItemType } from "./types.js";

/** A field that holds an item id, and which type that item must be. */
interface RefPath {
  path: string;
  /** An item type, or `any`. */
  target: string;
}

/** Collects every `x-fyi-ref` under a field, through lists and objects. */
function collect(name: string, field: FieldSchema, out: RefPath[]): void {
  if (field["x-fyi-ref"]) out.push({ path: name, target: field["x-fyi-ref"] });
  if (field.items) collect(name, field.items, out);
  for (const [key, sub] of Object.entries(field.properties ?? {})) {
    collect(`${name}.${key}`, sub, out);
  }
}

/** Reference fields per type, worked out once from the schemas. */
const REFS: Record<ItemType, RefPath[]> = Object.fromEntries(
  ITEM_TYPES.map((type) => {
    const out: RefPath[] = [];
    for (const [name, field] of Object.entries(SCHEMAS[type].properties)) collect(name, field, out);
    return [type, out];
  })
) as Record<ItemType, RefPath[]>;

/** Finds an item's type by id, or undefined when there is no such item. */
export type TypeOf = (id: string) => string | undefined;

/** Every reference in a set of fields that does not resolve, or resolves to the wrong type. */
export function refProblems(type: ItemType, fields: Record<string, unknown>, typeOf: TypeOf): string[] {
  const out: string[] = [];
  for (const ref of REFS[type]) {
    for (const id of valuesAt(fields, segments(ref.path))) {
      const found = typeOf(String(id));
      if (!found) out.push(`${ref.path}: no item with id "${id}"`);
      else if (ref.target !== "any" && found !== ref.target) {
        out.push(`${ref.path}: "${id}" is a ${found}, not a ${ref.target}`);
      }
    }
  }
  return out;
}

/**
 * Refuses fields pointing at an item that does not exist, or at one of
 * the wrong type. Only the fields given are checked, so an old dangling
 * reference never blocks an unrelated update.
 */
export function checkRefs(type: ItemType, fields: Record<string, unknown>): void {
  const [first] = refProblems(type, fields, (id) => get(id)?.item.type);
  if (first) throw new ToolError(first);
}

/**
 * Points every reference to `from` at `to` instead, across the whole
 * store, archive included. Returns the ids of the items it changed.
 */
export function rewriteRefs(from: string, to: string): string[] {
  const changed: string[] = [];
  for (const stored of all(true)) {
    let count = 0;
    for (const ref of REFS[stored.item.type]) {
      count += replaceAt(stored.item, segments(ref.path), from, to);
    }
    if (count > 0) {
      write(stored.item, stored.scope);
      changed.push(stored.item.id);
    }
  }
  return changed;
}
