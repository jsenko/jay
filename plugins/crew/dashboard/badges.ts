/**
 * The counts beside crew's views in the menu. Computed here rather than in the
 * page, because other plugins' dashboards show them too.
 */

import type { Badge } from "./shell/discover.js";
import { snapshot } from "./data.js";

/** Stale sessions, and jobs that need someone to act. Nothing when all is well. */
export function badges(): Record<string, Badge> {
  const { sessions, jobs } = snapshot();
  const out: Record<string, Badge> = {};
  const stale = sessions.filter((s) => s.status === "stale").length;
  if (stale) out.sessions = { n: stale, alert: true };
  const flagged = jobs.filter((j) => j.flagged).length;
  if (flagged) out.jobs = { n: flagged, alert: true };
  return out;
}
