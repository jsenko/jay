/** Domain operations over the job queue. See SPEC.md §4. */

import { appendMessage } from "./messages.js";
import { nowIso } from "./time.js";
import { isStale, type Job, type JobState, type Priority, type Session, type State } from "./types.js";

/** Reserved sender for messages the server itself raises. */
export const SYSTEM = "crew";

/** Lease granted on claim, and the ceiling `crew_extend` may reach. */
export const DEFAULT_LEASE_MIN = 60;
export const MAX_LEASE_MIN = 240;

/** Default time a job stays claimable before it is considered abandoned. */
export const DEFAULT_EXPIRY_MIN = 240;

/**
 * The longest a job waits for a session able to take it, counted from
 * posting, so work meant for a session that never comes still reaches
 * its poster.
 */
const MAX_WAIT_MS = 72 * 60 * 60 * 1000;

/** Reclaims before a job is treated as poisonous and set aside. */
const MAX_ATTEMPTS = 3;

/**
 * How long a job lingers after it ends, so its poster can still see the
 * outcome on the board. The poster is also sent a message, which stays
 * until read.
 */
const ENDED_RETAIN_MS = 60 * 60 * 1000;

/** States a job never leaves. */
const FINAL_STATES: ReadonlySet<JobState> = new Set(["done", "failed", "stuck", "expired"]);

const PRIORITY_ORDER: Record<Priority, number> = { critical: 0, high: 1, normal: 2, low: 3 };

/** An ISO timestamp `minutes` after `now`. */
export function minutesFrom(now: number, minutes: number): string {
  return new Date(now + minutes * 60_000).toISOString();
}

/**
 * A session that can be routed work: present, not departed, not stale,
 * and not currently held by the user.
 */
function isAvailable(session: Session, now: number): boolean {
  return session.status === "idle" || (session.status === "busy" && !isStale(session, now));
}

/** Whether the job's repository affinity permits this session. */
function repoAllows(job: Job, session: Session): boolean {
  if (!job.repo_required) return true;
  return job.repo !== undefined && session.repos.includes(job.repo);
}

/** Whether the soft reservation window still excludes this session. */
function reservationAllows(job: Job, session: Session, now: number): boolean {
  if (!job.prefer || job.prefer === session.id) return true;
  return job.prefer_until !== undefined && now > Date.parse(job.prefer_until);
}

/**
 * Sessions that could claim this job right now.
 *
 * Fallback sessions are a second tier: they are offered the job only
 * when nothing matches it on capability, which is what makes `fallback`
 * a safety net rather than a magnet for all work.
 */
export function eligibleSessions(state: State, job: Job, now = Date.now()): Session[] {
  if (job.state !== "open") return [];

  const candidates = Object.values(state.sessions).filter(
    (s) =>
      isAvailable(s, now) &&
      !isStale(s, now) &&
      repoAllows(job, s) &&
      reservationAllows(job, s, now) &&
      (job.to === undefined || job.to === s.id)
  );

  const byCapability = candidates.filter((s) =>
    job.needs.every((need) => s.capabilities.includes(need))
  );
  if (byCapability.length > 0) return byCapability;

  return candidates.filter((s) => s.fallback);
}

/** Whether one specific session may claim one specific job. */
export function isEligible(state: State, job: Job, session: Session, now = Date.now()): boolean {
  return eligibleSessions(state, job, now).some((s) => s.id === session.id);
}

/**
 * The job a session should take next: highest priority, then a matching
 * repository, then oldest first.
 */
export function nextJobFor(state: State, session: Session, now = Date.now()): Job | undefined {
  return Object.values(state.jobs)
    .filter((job) => isEligible(state, job, session, now))
    .sort((a, b) => {
      const priority = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (priority !== 0) return priority;

      const aRepo = a.repo && session.repos.includes(a.repo) ? 0 : 1;
      const bRepo = b.repo && session.repos.includes(b.repo) ? 0 : 1;
      if (aRepo !== bRepo) return aRepo - bRepo;

      return Date.parse(a.created_at) - Date.parse(b.created_at);
    })[0];
}

/** Jobs currently held by a session. */
export function jobsHeldBy(state: State, sessionId: string): Job[] {
  return Object.values(state.jobs).filter(
    (job) => job.state === "claimed" && job.claimed_by === sessionId
  );
}

/**
 * Jobs a session posted that now need a human decision — nobody could
 * take them, or they failed repeatedly.
 */
export function jobsNeedingPoster(state: State, sessionId: string): Job[] {
  return Object.values(state.jobs).filter(
    (job) => job.from === sessionId && (job.state === "stuck" || job.state === "expired")
  );
}

/**
 * A claimed job whose lease has run out while its holder is still alive.
 *
 * Reported to the poster rather than reclaimed: taking work away from a
 * session that is merely slow is worse than waiting (SPEC.md §4).
 */
export function isSlow(job: Job, state: State, now = Date.now()): boolean {
  if (job.state !== "claimed" || !job.lease_expires_at) return false;
  if (now <= Date.parse(job.lease_expires_at)) return false;

  const holder = job.claimed_by ? state.sessions[job.claimed_by] : undefined;
  return holder !== undefined && !isStale(holder, now);
}

/**
 * Applies time-based transitions.
 *
 * There is no daemon — one server runs per session — so this is called
 * at the start of every queue operation and the board is only ever as
 * current as the last tool call.
 */
export function sweep(state: State, now = Date.now()): void {
  for (const job of Object.values(state.jobs)) {
    if (job.state === "open") {
      sweepOpen(state, job, now);
      continue;
    }

    if (job.state === "claimed" && job.lease_expires_at && now > Date.parse(job.lease_expires_at)) {
      const holder = job.claimed_by ? state.sessions[job.claimed_by] : undefined;
      // Both conditions required: an expired lease alone means slow, not gone.
      if (!holder || isStale(holder, now)) reclaim(state, job);
    }
  }

  pruneEnded(state, now);
}

/**
 * Expires an open job only for time a session could have claimed it:
 * while none can, as when the only reviewer is in focus, the expiry is
 * pushed back, so the job waits rather than lapsing (SPEC.md §4).
 */
function sweepOpen(state: State, job: Job, now: number): void {
  const waitedMs = now - Date.parse(job.created_at);
  if (waitedMs > MAX_WAIT_MS) {
    expire(state, job, `expired after ${Math.round(waitedMs / 3_600_000)}h with no session able to take it`);
  } else if (eligibleSessions(state, job, now).length === 0) {
    job.expires_at = minutesFrom(now, job.expiry_min ?? DEFAULT_EXPIRY_MIN);
  } else if (now > Date.parse(job.expires_at)) {
    expire(state, job, "expired unclaimed");
  }
}

/** Returns a job to the pool, or sets it aside once it has failed enough. */
export function reclaim(state: State, job: Job): void {
  job.attempts += 1;
  delete job.claimed_by;
  delete job.lease_expires_at;

  if (job.attempts >= MAX_ATTEMPTS) {
    job.state = "stuck";
    job.ended_at = nowIso();
    notifyPoster(state, job, `job ${job.id} is stuck after ${job.attempts} attempts: ${job.body}`);
  } else {
    job.state = "open";
  }
}

/**
 * Marks an unclaimed job expired and tells the poster, whose move it is
 * to capture the work if it still matters (SPEC.md §4).
 */
function expire(state: State, job: Job, reason: string): void {
  job.state = "expired";
  job.ended_at = nowIso();
  notifyPoster(state, job, `job ${job.id} ${reason}: ${job.body}`);
}

/** Sends a system message to a job's poster, if that session still exists. */
export function notifyPoster(state: State, job: Job, body: string): void {
  if (state.sessions[job.from]) appendMessage(state, SYSTEM, job.from, body);
}

/**
 * Drops jobs that have ended, once their posters have had a chance to see
 * them. A job from before `ended_at` was recorded counts from creation.
 */
function pruneEnded(state: State, now: number): void {
  for (const [id, job] of Object.entries(state.jobs)) {
    if (!FINAL_STATES.has(job.state)) continue;
    if (now - Date.parse(job.ended_at ?? job.created_at) > ENDED_RETAIN_MS) {
      delete state.jobs[id];
    }
  }
}

/** Compact projection for `crew_poll` and the board view. */
export function jobSummary(job: Job, state: State, now = Date.now()) {
  return {
    id: job.id,
    from: job.from,
    body: job.body,
    needs: job.needs,
    repo: job.repo,
    priority: job.priority,
    state: job.state,
    claimed_by: job.claimed_by,
    lease_expires_at: job.lease_expires_at,
    attempts: job.attempts,
    slow: isSlow(job, state, now),
    ref: job.ref,
  };
}

/**
 * Everything still worth showing on the full board: open, claimed, and
 * anything that ended badly. Successfully finished work is not news.
 */
export function boardJobs(state: State): Job[] {
  return Object.values(state.jobs).filter(
    (job) => job.state !== "done" && job.state !== "failed"
  );
}

/** Allocates the next job id. */
export function nextJobId(state: State): string {
  const used = Object.keys(state.jobs).length;
  for (let n = used + 1; ; n++) {
    const id = `job-${n}`;
    if (!state.jobs[id]) return id;
  }
}
