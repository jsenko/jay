/** `crew_post` — put work on the board for someone to claim. */

import { ToolError } from "../errors.js";
import { DEFAULT_EXPIRY_MIN, eligibleSessions, minutesFrom, nextJobId, sweep } from "../jobs.js";
import { requireOwnSession } from "../sessions.js";
import { mutate } from "../store.js";
import { nowIso } from "../time.js";
import type { Job, Priority } from "../types.js";
import { requireString, validateCapabilities } from "../validation.js";
import { CAPABILITY_SCHEMA, type Tool } from "./tool.js";

const PRIORITIES: Priority[] = ["critical", "high", "normal", "low"];

/** Window during which only the preferred session may claim. */
const DEFAULT_PREFER_MIN = 10;

/**
 * Posts a job, directed when `to` is given and pooled otherwise.
 *
 * Reports routability synchronously: an empty `eligible_sessions` means
 * nothing can take this right now, and the poster learns at the call
 * rather than discovering it hours later (SPEC.md §4).
 */
async function handler(args: Record<string, any>) {
  const body = requireString(args.body, "body");
  const needs = validateCapabilities(args.needs);

  if (args.priority !== undefined && !PRIORITIES.includes(args.priority)) {
    throw new ToolError(`priority must be one of: ${PRIORITIES.join(", ")}`);
  }

  return mutate((state) => {
    const now = Date.now();
    sweep(state, now);
    const poster = requireOwnSession(state);

    if (args.to !== undefined && !state.sessions[args.to]) {
      const known = Object.keys(state.sessions).filter((id) => id !== poster.id);
      throw new ToolError(`unknown session "${args.to}". Known: ${known.join(", ") || "none"}`);
    }
    if (args.prefer !== undefined && !state.sessions[args.prefer]) {
      throw new ToolError(`unknown session "${args.prefer}" for prefer`);
    }

    const job: Job = {
      id: nextJobId(state),
      from: poster.id,
      body,
      to: args.to,
      needs,
      repo: args.repo,
      repo_required: Boolean(args.repo_required),
      priority: (args.priority as Priority) ?? "normal",
      prefer: args.prefer,
      prefer_until: args.prefer ? minutesFrom(now, DEFAULT_PREFER_MIN) : undefined,
      ref: args.ref,
      state: "open",
      attempts: 0,
      created_at: nowIso(),
      expires_at: minutesFrom(now, Number(args.expires_in) || DEFAULT_EXPIRY_MIN),
    };

    state.jobs[job.id] = job;

    const eligible = eligibleSessions(state, job, now).map((s) => s.id);
    return {
      job_id: job.id,
      routable: eligible.length > 0,
      eligible_sessions: eligible,
      expires_at: job.expires_at,
    };
  });
}

export const postTool: Tool = {
  definition: {
    name: "crew_post",
    description:
      "Post work for another session to do. Omit 'to' to offer it to whoever matches — the first session to claim it wins. Check 'routable' in the result: false means nobody can take it right now.",
    inputSchema: {
      type: "object",
      properties: {
        body: { type: "string", description: "What needs doing, with enough context to act on." },
        to: { type: "string", description: "Direct this at one session. Omit to offer it to the pool." },
        needs: CAPABILITY_SCHEMA,
        repo: { type: "string", description: "Repository this concerns, as Owner/Repo." },
        repo_required: {
          type: "boolean",
          description: "Only a session working in that repository may claim it.",
        },
        priority: { type: "string", enum: [...PRIORITIES] },
        prefer: {
          type: "string",
          description: "Give this session first refusal for 10 minutes, then open it to everyone.",
        },
        expires_in: { type: "number", description: "Minutes before the job expires unclaimed." },
        ref: { type: "string", description: "Pointer such as pr:Owner/Repo#123." },
      },
      required: ["body"],
    },
  },
  handler,
};
