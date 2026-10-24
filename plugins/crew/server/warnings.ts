/** Setup problems `crew_join` reports, from the state it already holds. */

import { eligibleSessions } from "./jobs.js";
import { isLive, type State } from "./types.js";

/**
 * Work stranded by the setup, one line each, or nothing. A healthy crew
 * gets no warnings, so the check adds nothing to a normal start.
 */
export function setupWarnings(state: State, now = Date.now()): string[] {
  const stranded = Object.values(state.jobs).filter(
    (job) => job.state === "open" && eligibleSessions(state, job, now).length === 0
  );
  if (stranded.length === 0) return [];

  const needs = [...new Set(stranded.flatMap((job) => job.needs))].sort();
  const fallback = Object.values(state.sessions).some((s) => s.fallback && isLive(s, now));
  return [
    `${stranded.length} job(s) wait for a session that can take them` +
      (needs.length > 0 ? `, needing ${needs.join(", ")}` : "") +
      `: start one, or end focus on one that can` +
      (fallback ? "" : ". No session sets fallback to catch unmatched work"),
  ];
}
