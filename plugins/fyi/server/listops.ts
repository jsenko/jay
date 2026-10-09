/**
 * Adding to and removing from list fields, without rewriting the list.
 *
 * Several sessions write to one `pr` item's attention items. Replacing
 * the whole list means reading it, editing it, and writing it back — and
 * anything another session added in between is silently lost, which is
 * exactly what a watcher resync once did. Changing one entry by
 * description leaves the others alone.
 */

import { ToolError } from "./errors.js";
import { SCHEMAS, validate } from "./schema.js";
import type { Item, ItemType } from "./types.js";

/** Field name to the entries to add, or to the patterns of entries to remove. */
export type ListOps = Record<string, unknown>;

/** A value with object keys sorted, so equal entries compare equal as text. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Whether a list entry matches a removal pattern: an object pattern
 * matches when every field it names is equal; anything else, when the
 * entry equals it.
 */
function matches(entry: unknown, pattern: unknown): boolean {
  if (typeof pattern === "object" && pattern !== null && !Array.isArray(pattern)) {
    if (typeof entry !== "object" || entry === null) return false;
    return Object.entries(pattern).every(([k, v]) => String((entry as Record<string, unknown>)[k]) === String(v));
  }
  return String(entry) === String(pattern);
}

/** Refuses an operation on a field that is not a list on this type. */
function requireList(type: ItemType, field: string, op: string): void {
  if (SCHEMAS[type].properties[field]?.type !== "array") {
    throw new ToolError(`${op}.${field}: not a list field on ${type}`);
  }
}

/**
 * The new value of every list field the operations touch. Removals apply
 * first, so a remove and an add on one field replace an entry in one
 * call.
 */
export function applyListOps(item: Item, add: ListOps = {}, remove: ListOps = {}): Record<string, unknown[]> {
  const out: Record<string, unknown[]> = {};

  for (const [field, patterns] of Object.entries(remove)) {
    requireList(item.type, field, "remove");
    const list = Array.isArray(patterns) ? patterns : [patterns];
    const current = (out[field] ?? (item[field] as unknown[] | undefined) ?? []) as unknown[];
    out[field] = current.filter((entry) => !list.some((pattern) => matches(entry, pattern)));
  }

  for (const [field, entries] of Object.entries(add)) {
    requireList(item.type, field, "add");
    const list = Array.isArray(entries) ? entries : [entries];
    validate(item.type, { [field]: list }, { partial: true });

    const current = (out[field] ?? (item[field] as unknown[] | undefined) ?? []) as unknown[];
    const seen = new Set(current.map(canonical));
    out[field] = [...current, ...list.filter((entry) => !seen.has(canonical(entry)))];
  }

  return out;
}
