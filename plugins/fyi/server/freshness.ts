/**
 * Freshness of mirrored items.
 *
 * Two kinds of item live here and they fail differently. An *authored*
 * item — task, note, project — cannot be stale: the store is the truth,
 * so old is not wrong. A *mirrored* item is a cache of an external
 * system, and goes wrong silently when that system moves and nothing
 * told us.
 *
 * This module only ever *reports*. Refreshing needs to know how to talk
 * to the source, and keeping that knowledge out of the store is what
 * lets a new mirrored type cost a schema entry rather than new code
 * here.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ITEM_TYPES, type Item, type ItemType } from "./types.js";

const SCHEMA_DIR = join(dirname(fileURLToPath(import.meta.url)), "schemas");

/** Where a mirrored type's truth lives, and how long before it is suspect. */
export interface FreshnessPolicy {
  /** The external system, for the message a caller shows. */
  source: string;
  /** Hours since last confirmation before the record is called stale. */
  max_age_hours: number;
}

/** Policies by type. A type without one is authored and never stale. */
export const POLICIES: Partial<Record<ItemType, FreshnessPolicy>> = Object.fromEntries(
  ITEM_TYPES.map((type) => {
    const schema = JSON.parse(readFileSync(join(SCHEMA_DIR, `${type}.json`), "utf8"));
    return [type, schema["x-fyi-freshness"]];
  }).filter(([, policy]) => policy !== undefined)
);

/** What a caller needs to decide whether to trust an item. */
export interface Freshness {
  source: string;
  /** Null when the item has never been confirmed against its source. */
  synced_at: string | null;
  /** Null when never confirmed. */
  age_hours: number | null;
  stale: boolean;
  /** Plain-language reason, for a caller to pass on unchanged. */
  note: string;
}

const HOUR_MS = 3_600_000;

/** Whether a type mirrors something external. */
export function isMirrored(type: ItemType): boolean {
  return POLICIES[type] !== undefined;
}

/**
 * Freshness for one item, or null when the type is authored.
 *
 * An item that has never been synced counts as stale: it was created
 * from something, but nothing recorded when, so it cannot be trusted
 * any more than an old one.
 */
export function freshnessOf(item: Item, now = Date.now()): Freshness | null {
  const policy = POLICIES[item.type];
  if (!policy) return null;

  const syncedAt = typeof item.synced_at === "string" ? item.synced_at : null;
  if (!syncedAt) {
    return {
      source: policy.source,
      synced_at: null,
      age_hours: null,
      stale: true,
      note: `never confirmed against ${policy.source}`,
    };
  }

  const ageHours = Math.round(((now - Date.parse(syncedAt)) / HOUR_MS) * 10) / 10;
  const stale = ageHours >= policy.max_age_hours;

  return {
    source: policy.source,
    synced_at: syncedAt,
    age_hours: ageHours,
    stale,
    note: stale
      ? `last confirmed against ${policy.source} ${ageHours}h ago; refresh before acting on it`
      : `confirmed against ${policy.source} ${ageHours}h ago`,
  };
}

/** Whether an item is both mirrored and out of date. */
export function isStale(item: Item, now = Date.now()): boolean {
  return freshnessOf(item, now)?.stale === true;
}
