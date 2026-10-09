/** `fyi_today` — everything that wants attention now, in one call. */

import { DEFAULT_SCOPE } from "../config.js";
import { search, summarise } from "../query.js";
import { all } from "../store.js";
import { daysFrom, today } from "../time.js";
import { SCOPES, type Scope, type StoredItem } from "../types.js";
import type { Tool } from "./tool.js";

/** Statuses that take a task out of the running. */
const CLOSED = ["done", "cancelled"];

const PRIORITY_ORDER = ["critical", "high", "medium", "low"];

/** Overdue first, then by priority, then by how soon it is due. */
function byUrgency(a: StoredItem, b: StoredItem): number {
  const aDays = daysFrom(String(a.item.next_action_at));
  const bDays = daysFrom(String(b.item.next_action_at));
  if (aDays !== bDays) return aDays - bDays;

  const aP = PRIORITY_ORDER.indexOf(String(a.item.priority ?? "medium"));
  const bP = PRIORITY_ORDER.indexOf(String(b.item.priority ?? "medium"));
  return aP - bP;
}

/**
 * The answer to "what needs me right now?" without the model having to
 * assemble it from several searches.
 *
 * Upcoming work is included but kept separate: seeing only what is due
 * today hides the thing due tomorrow that needed starting today.
 */
function handler(args: Record<string, any>) {
  const items = all();
  const scope = (args.scope as Scope | "all") ?? DEFAULT_SCOPE;
  const horizon = Number(args.horizon_days) || 7;
  const now = today();

  const tasks = search(items, { type: "task", scope }).filter(
    (s) => !CLOSED.includes(String(s.item.status ?? "open")) && s.item.next_action_at !== undefined
  );

  const due = tasks.filter((s) => String(s.item.next_action_at) <= now).sort(byUrgency);
  const upcoming = tasks
    .filter((s) => {
      const days = daysFrom(String(s.item.next_action_at));
      return days > 0 && days <= horizon;
    })
    .sort(byUrgency);

  const blocked = tasks.filter((s) => s.item.status === "blocked");

  const prs = search(items, { type: "pr", scope }).filter((s) => s.item.attention === true);
  const projects = search(items, { type: "project", where: { status: "active" }, scope });

  return {
    date: now,
    scope,
    due: due.map((s) => ({ ...summarise(s), overdue_days: -daysFrom(String(s.item.next_action_at)) })),
    upcoming: upcoming.map(summarise),
    blocked: blocked.map((s) => ({ ...summarise(s), blocked_on: s.item.blocked_on })),
    prs_needing_attention: prs.map(summarise),
    active_projects: projects.map(summarise),
  };
}

export const todayTool: Tool = {
  definition: {
    name: "fyi_today",
    description:
      "What needs attention now: tasks due or overdue, what is coming up, what is blocked, pull requests waiting on the user, and active projects. One call — use this rather than several searches.",
    inputSchema: {
      type: "object",
      properties: {
        scope: {
          type: "string",
          enum: [...SCOPES, "all"],
          description: `Which store to look in. Defaults to ${DEFAULT_SCOPE}; use "all" only when the question genuinely spans several.`,
        },
        horizon_days: {
          type: "number",
          description: "How far ahead to include upcoming tasks. Defaults to 7.",
        },
      },
    },
  },
  handler,
};
