/**
 * What crew's dashboard shows: the sessions on the board and the jobs not yet
 * finished, read from crew's own store.
 */

import { eligibleSessions, isSlow } from "../server/jobs.js";
import { read } from "../server/store.js";
import { isStale } from "../server/types.js";

/** States a job leaves the board in. */
const FINISHED = ["done", "failed"];

/**
 * A snapshot for the page. A job is flagged when it needs someone to act: it is
 * stuck or expired, its holder's lease ran out, or no session can take it.
 */
export function snapshot() {
  const state = read();
  const now = Date.now();
  const sessions = Object.values(state.sessions)
    .filter((s) => s.status !== "offline")
    .map((s) => ({ ...s, status: isStale(s, now) ? "stale" : s.status }));
  const jobs = Object.values(state.jobs)
    .filter((j) => !FINISHED.includes(j.state))
    .map((j) => {
      const unroutable = j.state === "open" && eligibleSessions(state, j, now).length === 0;
      const slow = isSlow(j, state, now);
      return { ...j, unroutable, slow, flagged: j.state === "stuck" || j.state === "expired" || unroutable || slow };
    });
  return { sessions, jobs };
}
