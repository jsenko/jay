/**
 * Wake signals.
 *
 * The signal carries no message content on purpose (SPEC.md §1): making
 * `crew_poll` the only delivery path keeps delivery cursor-mediated, so
 * a session that both receives a push and polls cannot double-process.
 */

import { watch } from "node:fs";
import { basename, dirname } from "node:path";

import { getSessionId } from "./context.js";
import { nextJobFor } from "./jobs.js";
import { unreadFor } from "./messages.js";
import { ensureDir, paths, read } from "./store.js";

/** Collapses the burst of writes a single mutation can produce. */
const DEBOUNCE_MS = 150;

/** Highest sequence already signalled, so one arrival wakes the session once. */
let signalledUpto = 0;

/** Job last signalled as claimable, so a standing offer wakes once. */
let signalledJob: string | null = null;

/**
 * Watches for state changes and invokes `signal` when this session has
 * something new.
 *
 * Watches the directory rather than the file: writes land through a
 * temp-file rename, which would break a watch held on the file itself.
 */
export function startNotifier(signal: () => void): void {
  const stateFile = basename(paths.STATE_FILE);
  let timer: NodeJS.Timeout | undefined;

  ensureDir();
  watch(dirname(paths.STATE_FILE), (_event, filename) => {
    if (filename !== stateFile) return;
    clearTimeout(timer);
    timer = setTimeout(() => check(signal), DEBOUNCE_MS);
  }).unref();
}

/** Signals only when unread work has appeared since the last signal. */
function check(signal: () => void): void {
  const id = getSessionId();
  if (!id) return;

  try {
    const state = read();
    const session = state.sessions[id];
    if (!session) return;

    const unread = unreadFor(state, session);
    const highest = unread.reduce((max, m) => Math.max(max, m.seq), 0);
    const claimable = nextJobFor(state, session)?.id ?? null;

    if (highest > signalledUpto || (claimable !== null && claimable !== signalledJob)) {
      signalledUpto = Math.max(signalledUpto, highest);
      signalledJob = claimable;
      signal();
    }
  } catch {
    // A torn read during someone else's write; the next event re-checks.
  }
}
