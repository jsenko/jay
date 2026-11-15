/**
 * Work focus keeps from a session, and why a job no session can take is
 * waiting. A job handed to a focused session used to wait in silence, and
 * its poster saw only `routable: false`: on 9 November the user's own
 * hand-off of two jobs to a coder was stuck behind that coder's focus,
 * and nothing said so (SPEC.md §4).
 */

import { focusHolds } from "./focus.js";
import { isEligible, mayClaimById, placementAllows, suits } from "./jobs.js";
import { isStale, type Job, type Session, type State } from "./types.js";

/**
 * Open jobs this session could take but its focus holds back: a claim by
 * id would succeed, routing never offers them. Directed ones first, the
 * hand-offs meant for it.
 */
export function heldByFocus(state: State, session: Session, now = Date.now()): Job[] {
  if (!focusHolds(session, now)) return [];
  return Object.values(state.jobs)
    .filter((job) => mayClaimById(state, job, session, now) && !isEligible(state, job, session, now))
    .sort((a, b) => Number(b.to === session.id) - Number(a.to === session.id));
}

/** A session that could be routed work but for its status: there, and not stale. */
function present(session: Session, now: number): boolean {
  return session.status !== "offline" && !isStale(session, now);
}

/** Why no session can take an open job now, in one line for its poster. */
export function whyWaiting(state: State, job: Job, now = Date.now()): string {
  const sessions = Object.values(state.sessions).filter((s) => present(s, now));
  const wanted = [job.role && `started as ${job.role}`, job.needs.length > 0 && `advertising ${job.needs.join(", ")}`].filter(Boolean).join(" and ");

  if (job.to !== undefined) {
    const target = sessions.find((s) => s.id === job.to);
    if (!target) return `${job.to} is offline`;
    if (!suits(job, target)) return `${job.to} isn't a session ${wanted}`;
    if (focusHolds(target, now)) return `${job.to} is in focus with the user, and has been told the job is there`;
    return `${job.to} can't take it yet`;
  }

  const capable = sessions.filter((s) => suits(job, s));
  if (capable.length === 0) return wanted ? `no session ${wanted}` : "no session is there";
  const placed = capable.filter((s) => placementAllows(job, s, now));
  if (placed.length === 0) {
    return job.repo_required ? `no session that can take it works in ${job.repo}` : `reserved for ${job.prefer}`;
  }
  const focused = placed.filter((s) => focusHolds(s, now)).map((s) => s.id);
  if (focused.length > 0) return `every session that can take it is in focus with the user: ${focused.join(", ")}`;
  return "no session that can take it is free";
}
