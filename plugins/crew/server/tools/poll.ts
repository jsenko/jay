/** `crew_poll` — collect anything waiting for this session. */

import {
  boardJobs,
  jobSummary,
  jobsHeldBy,
  jobsNeedingPoster,
  nextJobFor,
  sweep,
} from "../jobs.js";
import { markRead, pruneMessages, unreadFor } from "../messages.js";
import { requireOwnSession } from "../sessions.js";
import { mutate } from "../store.js";
import type { Tool } from "./tool.js";

/**
 * The single delivery path for messages, whether the session was woken
 * by a push signal or is polling on a timer.
 *
 * Returns an empty object when there is nothing, so an idle check costs
 * almost no context — the point of replacing the old per-tick command
 * file. `board` asks instead for everything outstanding anywhere, which
 * is deliberately not part of the cheap path.
 */
async function handler(args: Record<string, any>) {
  return mutate((state) => {
    const now = Date.now();
    sweep(state, now);
    const session = requireOwnSession(state);

    const unread = unreadFor(state, session);
    // Everything up to the latest message is now consumed: what isn't in
    // `unread` was never for this session, and must not hold the cursor back.
    markRead(state, session, state.seq);
    pruneMessages(state);

    const held = jobsHeldBy(state, session.id);
    const needsPoster = jobsNeedingPoster(state, session.id);
    const claimable = nextJobFor(state, session, now);

    const result: Record<string, unknown> = {};
    if (unread.length > 0) {
      result.messages = unread.map((m) => ({ seq: m.seq, from: m.from, body: m.body, at: m.at }));
    }
    if (claimable) {
      result.claimable = jobSummary(claimable, state, now);
    }
    if (held.length > 0) {
      result.jobs_mine = held.map((job) => jobSummary(job, state, now));
    }
    if (needsPoster.length > 0) {
      result.jobs_needing_attention = needsPoster.map((job) => jobSummary(job, state, now));
    }

    if (args.board) {
      result.board = boardJobs(state).map((job) => jobSummary(job, state, now));
      result.sessions = Object.values(state.sessions)
        .filter((s) => s.status !== "offline")
        .map((s) => ({ id: s.id, status: s.status, capabilities: s.capabilities }));
    }

    return result;
  });
}

export const pollTool: Tool = {
  definition: {
    name: "crew_poll",
    description:
      "Check for messages and work waiting for this session. Returns an empty object when there is nothing. Call after a crew wake notification, or on a timer when notifications are unavailable. Pass board:true to see everything outstanding across all sessions, including work nothing can currently take.",
    inputSchema: {
      type: "object",
      properties: {
        board: {
          type: "boolean",
          description: "Include every outstanding job and session, not just this session's.",
        },
      },
    },
  },
  handler,
};
