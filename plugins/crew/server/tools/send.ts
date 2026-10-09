/** `crew_send` — deliver a message to one session or to everyone. */

import { ToolError } from "../errors.js";
import { ALL, appendMessage } from "../messages.js";
import { requireOwnSession } from "../sessions.js";
import { mutate } from "../store.js";
import { relTime } from "../time.js";
import { isStale } from "../types.js";
import { requireString } from "../validation.js";
import type { Tool } from "./tool.js";

/**
 * Messages are informational and carry no state machine — use
 * `crew_post` for work that someone must act on.
 *
 * Sending to an unreachable session succeeds with a warning rather than
 * failing: the message waits, and the sender decides what to do about it.
 */
async function handler(args: Record<string, any>) {
  const to = requireString(args.to, "to");
  const body = requireString(args.body, "body");

  return mutate((state) => {
    const sender = requireOwnSession(state);

    let warning: string | undefined;
    if (to !== ALL) {
      const recipient = state.sessions[to];
      if (!recipient) {
        const known = Object.keys(state.sessions).filter((id) => id !== sender.id);
        throw new ToolError(
          `unknown session "${to}". Known: ${known.join(", ") || "none"} (or "all")`
        );
      }
      if (recipient.status === "offline") {
        warning = `${to} has left; the message will wait`;
      } else if (isStale(recipient)) {
        warning = `${to} was last seen ${relTime(recipient.last_seen)} and may be gone`;
      }
    }

    const message = appendMessage(state, sender.id, to, body);
    return warning ? { seq: message.seq, warning } : { seq: message.seq };
  });
}

export const sendTool: Tool = {
  definition: {
    name: "crew_send",
    description:
      "Send an informational message to another session, or to \"all\". For work that someone must act on, use crew_post instead.",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient session id, or \"all\" to broadcast." },
        body: { type: "string", description: "The message." },
      },
      required: ["to", "body"],
    },
  },
  handler,
};
