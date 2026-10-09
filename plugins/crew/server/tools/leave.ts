/** `crew_leave` — deregister this session and give back its work. */

import { getSessionId, setSessionId } from "../context.js";
import { releaseClaims } from "../sessions.js";
import { mutate } from "../store.js";
import { nowIso } from "../time.js";
import type { Tool } from "./tool.js";

/**
 * Marks the session offline and returns held jobs to the pool.
 *
 * Also called from the shutdown path, so it tolerates being invoked when
 * no session was ever joined.
 */
export async function leave() {
  const id = getSessionId();

  const result = await mutate((state) => {
    if (!id || !state.sessions[id]) return { released: [] as string[], id: null };
    const released = releaseClaims(state, id);
    state.sessions[id].status = "offline";
    state.sessions[id].last_seen = nowIso();
    return { released, id };
  });

  setSessionId(null);
  return { left: result.id, released_jobs: result.released };
}

export const leaveTool: Tool = {
  definition: {
    name: "crew_leave",
    description: "Deregister this session and release any work it holds.",
    inputSchema: { type: "object", properties: {} },
  },
  handler: leave,
};
