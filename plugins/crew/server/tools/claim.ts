/** `crew_claim` — take work off the board. */

import { DEFAULT_LEASE_MIN, isEligible, minutesFrom, nextJobFor, sweep } from "../jobs.js";
import { requireOwnSession } from "../sessions.js";
import { mutate } from "../store.js";
import type { Tool } from "./tool.js";

/**
 * Claims the best-matching job and returns its content in one call.
 *
 * Claims are atomic under the state lock, so a pooled job offered to
 * several sessions goes to whichever claims first; the others are told
 * it was taken, which is a result rather than an error.
 */
async function handler(args: Record<string, any>) {
  return mutate((state) => {
    const now = Date.now();
    sweep(state, now);
    const session = requireOwnSession(state);

    const job = args.job_id
      ? state.jobs[String(args.job_id)]
      : nextJobFor(state, session, now);

    if (!job) {
      return args.job_id ? { claimed: null, reason: "no such job" } : { claimed: null };
    }
    if (job.state !== "open") {
      return { claimed: null, reason: job.state === "claimed" ? "taken" : job.state };
    }
    if (!isEligible(state, job, session, now)) {
      return { claimed: null, reason: "not eligible for this session" };
    }

    job.state = "claimed";
    job.claimed_by = session.id;
    job.lease_expires_at = minutesFrom(now, DEFAULT_LEASE_MIN);

    return {
      claimed: {
        id: job.id,
        from: job.from,
        body: job.body,
        repo: job.repo,
        priority: job.priority,
        ref: job.ref,
        lease_expires_at: job.lease_expires_at,
        attempts: job.attempts,
      },
    };
  });
}

export const claimTool: Tool = {
  definition: {
    name: "crew_claim",
    description:
      "Take the next job matching this session. Call with no arguments for the best match. Returns {claimed: null} when there is nothing — that is normal, not an error. Finish with crew_resolve.",
    inputSchema: {
      type: "object",
      properties: {
        job_id: { type: "string", description: "Claim one specific job instead of the best match." },
      },
    },
  },
  handler,
};
