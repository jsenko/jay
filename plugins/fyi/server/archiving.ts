/**
 * Continuous archiving.
 *
 * Items leave the active set on their own, as a consequence of reaching
 * a terminal state and sitting there — not because someone remembered to
 * run a cleanup. A periodic reconciliation pass is exactly the chore
 * that does not happen, so the store has to keep itself tidy.
 *
 * Archiving never deletes: the file moves to the archive directory and
 * stays readable and searchable on request.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ITEM_TYPES, type Item, type ItemType } from "./types.js";

const SCHEMA_DIR = join(dirname(fileURLToPath(import.meta.url)), "schemas");

/** Archived some days after a field reaches a terminal value. */
export interface StatePolicy {
  /** The field whose value says the work is over. */
  field: string;
  /** Values of that field that count as finished. */
  terminal: string[];
  /** How long a finished item lingers before being archived. */
  after_days: number;
}

/**
 * Archived when the item a reference field points at is archived — a
 * project's notes leave with the project. Notes have no state of their
 * own that could say they are finished, but the project they belong to
 * does.
 */
export interface FollowPolicy {
  /** The reference field naming the item to follow. */
  follows: string;
}

/** A type's archive policy, from `x-fyi-archive`. */
export type ArchivePolicy = StatePolicy | FollowPolicy;

/** Policies by type. A type without one is never archived automatically. */
export const POLICIES: Partial<Record<ItemType, ArchivePolicy>> = Object.fromEntries(
  ITEM_TYPES.map((type) => {
    const schema = JSON.parse(readFileSync(join(SCHEMA_DIR, `${type}.json`), "utf8"));
    return [type, schema["x-fyi-archive"]];
  }).filter(([, policy]) => policy !== undefined)
);

const DAY_MS = 86_400_000;

/** Finds an item, active or archived, for a follow policy to look at. */
export type Lookup = (id: string) => Item | undefined;

/**
 * Whether an item's time in the active set is up.
 *
 * `pinned` opts out entirely; `archive_after_days` overrides the type's
 * default, so a single item can linger longer or go immediately.
 */
export function shouldArchive(item: Item, lookup: Lookup, now = Date.now()): boolean {
  if (item.archived || item.pinned) return false;

  const policy = POLICIES[item.type];
  if (!policy) return false;

  if ("follows" in policy) {
    const target = item[policy.follows];
    return typeof target === "string" && lookup(target)?.archived === true;
  }

  const state = item[policy.field];
  if (typeof state !== "string" || !policy.terminal.includes(state)) return false;

  const after = typeof item.archive_after_days === "number" ? item.archive_after_days : policy.after_days;
  const since = Date.parse(String(item.updated_at ?? item.created_at ?? ""));
  if (Number.isNaN(since)) return false;

  return now - since >= after * DAY_MS;
}
