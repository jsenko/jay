/**
 * The few things the dashboard can change.
 *
 * Writes go through the same store the servers use, so validation,
 * archiving and atomic replacement all apply — the dashboard is not a
 * second way to write items, just a second caller.
 */

import { stampCompletion } from "../server/completion.js";
import { get, write } from "../server/store.js";
import { nowIso } from "../server/time.js";

/** Marks a task done. Archiving then moves it out on its own. */
export function complete(id: string): { ok: boolean; error?: string } {
  const stored = get(id);
  if (!stored) return { ok: false, error: `no item "${id}"` };

  const now = nowIso();
  const done = { ...stored.item, status: "done", updated_at: now };
  stampCompletion(done, stored.item, {}, now);
  write(done, stored.scope);
  return { ok: true };
}

/** Pushes a task's next action out by a number of days. */
export function snooze(id: string, days: number): { ok: boolean; error?: string } {
  const stored = get(id);
  if (!stored) return { ok: false, error: `no item "${id}"` };

  const date = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  stored.item.next_action_at = date;
  stored.item.updated_at = nowIso();
  write(stored.item, stored.scope);
  return { ok: true, ...{ next_action_at: date } };
}
