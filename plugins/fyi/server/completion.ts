/**
 * When an item finished.
 *
 * `updated_at` moves with every edit, so "finished last week" read from
 * it shifts whenever a finished item is touched again. `completed_at` is
 * stamped once, on the change into a finished state, for every type whose
 * archive policy names one — which is also what archiving counts from.
 */

import { POLICIES, type StatePolicy } from "./archiving.js";
import type { Item } from "./types.js";

/** The type's finished-state policy, if it has one. */
function statePolicy(item: Item): StatePolicy | undefined {
  const policy = POLICIES[item.type];
  return policy && "field" in policy ? policy : undefined;
}

/** Whether an item is in one of its type's finished states; never for a type without one. */
export function isFinished(item: Item | undefined): boolean {
  const policy = item && statePolicy(item);
  if (!item || !policy) return false;

  const state = item[policy.field];
  return typeof state === "string" && policy.terminal.includes(state);
}

/**
 * Keeps `completed_at` in step with a write, in place.
 *
 * Stamped on entering a finished state, kept while it stays finished, and
 * cleared when it is reopened. A value the caller supplies wins, so work
 * finished before it was recorded can say when.
 *
 * @param previous the item as stored before this write, or undefined for a new one
 * @param supplied the fields the caller passed
 */
export function stampCompletion(item: Item, previous: Item | undefined, supplied: Record<string, unknown>, now: string): void {
  if (!statePolicy(item)) return;

  if (!isFinished(item)) {
    delete item.completed_at;
  } else if (supplied.completed_at === undefined && !isFinished(previous)) {
    item.completed_at = now;
  }
}
