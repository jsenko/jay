/**
 * The counts beside fyi's views in the menu. Computed here rather than in the page,
 * because other plugins' dashboards show them too.
 */

import type { Badge } from "./shell/discover.js";
import { snapshot } from "./data.js";

/** Tasks due today or overdue, and pull requests waiting on the user. */
export function badges(): Record<string, Badge> {
  const state = snapshot();
  const out: Record<string, Badge> = {};
  if (state.tasks.due.length) {
    out.today = { n: state.tasks.due.length, alert: state.tasks.due.some((t) => t.overdue_days > 0) };
  }
  const waiting = state.prs.filter((p) => p.attention).length;
  if (waiting) out.prs = { n: waiting, alert: true };
  return out;
}
