/**
 * Assembles what the dashboard shows.
 *
 * Reads the server's domain modules directly rather than going through
 * MCP. MCP is a façade for models; the dashboard is a second façade over
 * the same store, so it needs the layer underneath rather than another
 * copy of the parsing.
 */

import { search } from "../server/query.js";
import { all } from "../server/store.js";
import { daysFrom, today } from "../server/time.js";
import { freshnessOf } from "../server/freshness.js";
import type { Scope, StoredItem } from "../server/types.js";

import { withWho, type AttentionItem } from "./attention.js";

/** Statuses that take a task out of the running. */
const CLOSED = ["done", "cancelled"];

const PRIORITY = ["critical", "high", "medium", "low"];

/** Overdue first, then by priority. */
function byUrgency(a: StoredItem, b: StoredItem): number {
  const days = daysFrom(String(a.item.next_action_at)) - daysFrom(String(b.item.next_action_at));
  if (days !== 0) return days;
  return PRIORITY.indexOf(String(a.item.priority ?? "medium")) - PRIORITY.indexOf(String(b.item.priority ?? "medium"));
}

/**
 * An item as the page needs it: every field, for the details panel, plus
 * which store it came from. The list rows pick out what they show.
 */
function full(stored: StoredItem) {
  return { ...stored.item, scope: stored.scope };
}

/** A task, with how late its next action is. `due` stays the real deadline. */
function taskView(stored: StoredItem) {
  const next = String(stored.item.next_action_at ?? "");
  return { ...full(stored), next, overdue_days: -daysFrom(next) };
}

const IMPORTANCE = ["critical", "high", "medium", "low"];

/** A PR, with whose move each attention item is and whether it can be trusted. */
function prView(stored: StoredItem) {
  const items = ((stored.item.attention_items as AttentionItem[] | undefined) ?? []).map(withWho);
  return {
    ...full(stored),
    attention: stored.item.attention === true,
    attention_items: items,
    stale: freshnessOf(stored.item)?.stale === true,
  };
}

/** Wanting the user first, then by importance, then the oldest. */
function byNeed(a: ReturnType<typeof prView>, b: ReturnType<typeof prView>): number {
  if (a.attention !== b.attention) return Number(b.attention) - Number(a.attention);
  const imp = IMPORTANCE.indexOf(String(a.importance ?? "low")) - IMPORTANCE.indexOf(String(b.importance ?? "low"));
  if (imp !== 0) return imp;
  return String(a.opened_at ?? "").localeCompare(String(b.opened_at ?? ""));
}

/** Everything the page renders, in one pass over the store. */
export function snapshot(scope: Scope | "all" = "all") {
  const items = all();
  const now = today();

  const tasks = search(items, { type: "task", scope }).filter(
    (s) => !CLOSED.includes(String(s.item.status ?? "open")) && s.item.next_action_at !== undefined
  );

  const due = tasks.filter((s) => String(s.item.next_action_at) <= now).sort(byUrgency);
  const upcoming = tasks
    .filter((s) => {
      const d = daysFrom(String(s.item.next_action_at));
      return d > 0 && d <= 14;
    })
    .sort(byUrgency);

  const prs = search(items, { type: "pr", scope }).map(prView).sort(byNeed);

  const projects = search(items, { type: "project", scope, where: { status: ["active", "paused"] } }).map((s) => ({
    ...full(s),
    current_state_age: s.item.current_state_at ? -daysFrom(String(s.item.current_state_at).slice(0, 10)) : null,
  }));

  return {
    date: now,
    tasks: { due: due.map(taskView), upcoming: upcoming.map(taskView) },
    prs,
    projects,
  };
}
