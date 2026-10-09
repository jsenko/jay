/** `crew_who` — the roster of active sessions. */

import { getSessionId } from "../context.js";
import { liveSessions, reapSessions, rosterEntry, touch } from "../sessions.js";
import { mutate } from "../store.js";
import type { Tool } from "./tool.js";

/** Lists sessions that have not left, most recently seen first. */
async function handler() {
  const sessions = await mutate((state) => {
    touch(state);
    reapSessions(state);
    return liveSessions(state)
      .sort((a, b) => Date.parse(b.last_seen) - Date.parse(a.last_seen))
      .map(rosterEntry);
  });

  return { you: getSessionId(), sessions };
}

export const whoTool: Tool = {
  definition: {
    name: "crew_who",
    description:
      "List active sessions: what each is doing, where, and how recently it was seen.",
    inputSchema: { type: "object", properties: {} },
  },
  handler,
};
