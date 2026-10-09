/** Domain operations over the session registry in shared state. */

import { getSessionId } from "./context.js";
import { ToolError } from "./errors.js";
import { nowIso, relTime } from "./time.js";
import { isStale, type Session, type State } from "./types.js";

/** Sessions untouched for longer than this are dropped from the roster. */
const REAP_AFTER_MS = 24 * 60 * 60 * 1000;

/** Removes long-dead sessions so the roster stays readable. */
export function reapSessions(state: State): void {
  const cutoff = Date.now() - REAP_AFTER_MS;
  for (const [id, session] of Object.entries(state.sessions)) {
    if (Date.parse(session.last_seen) < cutoff) delete state.sessions[id];
  }
}

/**
 * Refreshes this session's heartbeat. Every tool call counts as activity
 * (SPEC.md §2), so callers invoke this rather than updating `last_seen`
 * by hand.
 */
export function touch(state: State): Session | null {
  const id = getSessionId();
  if (!id) return null;
  const session = state.sessions[id];
  if (session) session.last_seen = nowIso();
  return session ?? null;
}

/** Like `touch`, but fails when the caller has not joined. */
export function requireOwnSession(state: State): Session {
  const session = touch(state);
  if (!session) throw new ToolError("not joined — call crew_join first");
  return session;
}

/** Sessions visible on the roster: everything that has not left. */
export function liveSessions(state: State): Session[] {
  return Object.values(state.sessions).filter((s) => s.status !== "offline");
}

/**
 * Roster projection. Stale sessions report as `stale` rather than their
 * last self-declared status, which would otherwise read as current.
 */
export function rosterEntry(session: Session) {
  return {
    id: session.id,
    purpose: session.purpose,
    repos: session.repos,
    directory: session.directory,
    capabilities: session.capabilities,
    fallback: session.fallback,
    status: isStale(session) ? "stale" : session.status,
    activity: session.activity,
    last_seen: relTime(session.last_seen),
  };
}

/** Returns held jobs to the pool. Used on leave and on stale reclaim. */
export function releaseClaims(state: State, sessionId: string): string[] {
  const released: string[] = [];
  for (const job of Object.values(state.jobs)) {
    if (job.claimed_by === sessionId && job.state === "claimed") {
      job.state = "open";
      delete job.claimed_by;
      delete job.lease_expires_at;
      released.push(job.id);
    }
  }
  return released;
}
