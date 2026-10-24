/** Keeps a running session's `last_seen` fresh between tool calls. */

import { getSessionId } from "./context.js";
import { touch } from "./sessions.js";
import { mutate } from "./store.js";

/**
 * How often a joined session refreshes `last_seen`: well inside the
 * staleness window, so a session waiting quietly for a push stays
 * routable and only a process that died goes stale (SPEC.md §5).
 * `CREW_HEARTBEAT_MS` shortens it for tests.
 */
const HEARTBEAT_MS = Number(process.env.CREW_HEARTBEAT_MS) || 5 * 60 * 1000;

/** Starts the timer. It never keeps the process alive on its own. */
export function startHeartbeat(): void {
  setInterval(() => {
    if (!getSessionId()) return;
    mutate(touch).catch((err) => console.error(`[crew] heartbeat failed: ${err.stack ?? err}`));
  }, HEARTBEAT_MS).unref();
}
