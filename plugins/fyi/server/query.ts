/**
 * Search over the in-memory index.
 *
 * Filters are kept to what a real query engine can serve — equality, set
 * membership, ranges, substring — rather than growing ad-hoc options
 * that would not survive swapping the storage layer for markbase.
 */

import { DEFAULT_SCOPE } from "./config.js";
import { freshnessOf } from "./freshness.js";
import { BODY_FIELD, type Item, type ItemType, type Scope, type StoredItem } from "./types.js";
import { matchesWhere, type Where } from "./where.js";

/** A search request. Every field is optional and they combine with AND. */
export interface Query {
  /** Scopes to search, or every scope; nothing named means the default. */
  scope?: Scope | Scope[] | "all";
  type?: ItemType | ItemType[];
  text?: string;
  /** Field conditions; see `where.ts`. */
  where?: Where;
  include_archived?: boolean;
  limit?: number;
}

function asList<T>(value: T | T[] | undefined): T[] | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value : [value];
}

/** Whether one item satisfies a query. */
function matches(item: Item, q: Query): boolean {
  if (!q.include_archived && item.archived) return false;

  const types = asList(q.type);
  if (types && !types.includes(item.type)) return false;

  if (q.text) {
    const needle = q.text.toLowerCase();
    const body = String(item[BODY_FIELD[item.type]] ?? "");
    if (!`${item.title} ${body}`.toLowerCase().includes(needle)) return false;
  }

  return !q.where || matchesWhere(item, q.where);
}

/** Most recently updated first, so the newest work reads at the top. */
function byRecency(a: StoredItem, b: StoredItem): number {
  return String(b.item.updated_at ?? "").localeCompare(String(a.item.updated_at ?? ""));
}

/** Applies a query to a set of items. */
export function search(items: StoredItem[], q: Query): StoredItem[] {
  const scopes = q.scope === "all" ? "all" : asList(q.scope) ?? [DEFAULT_SCOPE];
  const found = items
    .filter((stored) => scopes === "all" || scopes.includes(stored.scope))
    .filter((stored) => matches(stored.item, q))
    .sort(byRecency);
  return q.limit ? found.slice(0, q.limit) : found;
}

/** Compact projection: enough to decide whether to open the item. */
export function summarise(stored: StoredItem): Record<string, unknown> {
  const { item } = stored;
  const out: Record<string, unknown> = { id: item.id, type: item.type, title: item.title };
  if (stored.scope !== DEFAULT_SCOPE) out.scope = stored.scope;

  for (const field of ["status", "next_action_at", "due", "priority", "project", "tags", "repo", "number", "attention"]) {
    if (item[field] !== undefined) out[field] = item[field];
  }

  // Mirrored items can be wrong rather than merely old, so the warning
  // rides along rather than waiting to be asked for.
  const freshness = freshnessOf(item);
  if (freshness?.stale) out.stale = freshness.note;

  return out;
}
