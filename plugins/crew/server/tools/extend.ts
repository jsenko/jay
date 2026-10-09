/** `crew_extend` — keep a lease alive for long-running work. */

import { ToolError } from "../errors.js";
import { MAX_LEASE_MIN, minutesFrom, sweep } from "../jobs.js";
import { requireOwnSession } from "../sessions.js";
import { mutate } from "../store.js";
import { requireString } from "../validation.js";
import type { Tool } from "./tool.js";

/**
 * Pushes the lease out, capped at the maximum.
 *
 * Needed when work outlasts the default lease without the session making
 * any other crew call, which is common during a long review.
 */
async function handler(args: Record<string, any>) {
  const jobId = requireString(args.job_id, "job_id");
  const minutes = Number(args.minutes);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    throw new ToolError("minutes must be a positive number");
  }

  return mutate((state) => {
    sweep(state);
    const session = requireOwnSession(state);
    const job = state.jobs[jobId];

    if (!job) throw new ToolError(`unknown job "${jobId}"`);
    if (job.claimed_by !== session.id) {
      throw new ToolError(`job ${jobId} is not held by this session`);
    }

    job.lease_expires_at = minutesFrom(Date.now(), Math.min(minutes, MAX_LEASE_MIN));
    return { lease_expires_at: job.lease_expires_at };
  });
}

export const extendTool: Tool = {
  definition: {
    name: "crew_extend",
    description:
      "Extend the lease on a job this session holds, when the work is taking longer than expected.",
    inputSchema: {
      type: "object",
      properties: {
        job_id: { type: "string" },
        minutes: { type: "number", description: `Minutes from now, up to ${MAX_LEASE_MIN}.` },
      },
      required: ["job_id", "minutes"],
    },
  },
  handler,
};
