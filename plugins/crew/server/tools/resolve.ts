/** `crew_resolve` — report the outcome of claimed work. */

import { ToolError } from "../errors.js";
import { notifyPoster, reclaim, sweep } from "../jobs.js";
import { requireOwnSession } from "../sessions.js";
import { mutate } from "../store.js";
import { requireString } from "../validation.js";
import type { Tool } from "./tool.js";

const OUTCOMES = ["done", "failed", "released"] as const;
type Outcome = (typeof OUTCOMES)[number];

/**
 * Closes out a job.
 *
 * `released` counts as an attempt, like a reclaim does: a job that every
 * session hands back is exactly the case the poison guard exists for.
 */
async function handler(args: Record<string, any>) {
  const jobId = requireString(args.job_id, "job_id");
  const outcome = args.outcome as Outcome;
  if (!OUTCOMES.includes(outcome)) {
    throw new ToolError(`outcome must be one of: ${OUTCOMES.join(", ")}`);
  }

  return mutate((state) => {
    sweep(state);
    const session = requireOwnSession(state);
    const job = state.jobs[jobId];

    if (!job) throw new ToolError(`unknown job "${jobId}"`);
    if (job.claimed_by !== session.id) {
      throw new ToolError(
        job.claimed_by
          ? `job ${jobId} is held by ${job.claimed_by}, not this session`
          : `job ${jobId} is not claimed`
      );
    }

    const detail = typeof args.detail === "string" ? args.detail : "";

    if (outcome === "released") {
      reclaim(state, job);
      return { ok: true, state: job.state, attempts: job.attempts };
    }

    job.state = outcome;
    delete job.lease_expires_at;
    notifyPoster(state, job, `job ${job.id} ${outcome}${detail ? `: ${detail}` : ""}`);
    return { ok: true, state: job.state };
  });
}

export const resolveTool: Tool = {
  definition: {
    name: "crew_resolve",
    description:
      "Report how claimed work ended: 'done' when finished, 'failed' when it cannot be completed, 'released' to hand it back for someone else. The poster is notified.",
    inputSchema: {
      type: "object",
      properties: {
        job_id: { type: "string" },
        outcome: { type: "string", enum: [...OUTCOMES] },
        detail: { type: "string", description: "A sentence on the result, sent to the poster." },
      },
      required: ["job_id", "outcome"],
    },
  },
  handler,
};
