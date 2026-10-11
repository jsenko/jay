/**
 * Push signals: `wake` when something is waiting, and `hello` once after a
 * join, so the session learns that pushes reach it.
 *
 * A signal carries no message content on purpose (SPEC.md §1): making
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

/** Lets the join's answer reach the session before the hello does. */
const GREET_DELAY_MS = 200;

/** What a push says. */
export type Push = "wake" | "hello";

/** Sends a push to this session; set by `startNotifier`. */
let push: (kind: Push) => void = () => {};

/** Highest sequence already signalled, so one arrival wakes the session once. */
let signalledUpto = 0;

/** Job last signalled as claimable, so a standing offer wakes once. */
let signalledJob: string | null = null;

/**
 * Watches for state changes and pushes `wake` when this session has
 * something new.
 *
 * Watches the directory rather than the file: writes land through a
 * temp-file rename, which would break a watch held on the file itself.
 */
export function startNotifier(send: (kind: Push) => void): void {
  push = send;
  const stateFile = basename(paths.STATE_FILE);
  let timer: NodeJS.Timeout | undefined;

  ensureDir();
  watch(dirname(paths.STATE_FILE), (_event, filename) => {
    if (filename !== stateFile) return;
    clearTimeout(timer);
    timer = setTimeout(check, DEBOUNCE_MS);
  }).unref();
}

/**
 * Tells a session that has just joined that pushes reach it. The client does
 * not say whether it delivers them, so the session learns it by receiving one,
 * after the join's answer (SPEC.md §1).
 */
export function greet(): void {
  setTimeout(() => push("hello"), GREET_DELAY_MS).unref();
}

/** Wakes the session only when unread work has appeared since the last wake. */
function check(): void {
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
      push("wake");
    }
  } catch {
    // A torn read during someone else's write; the next event re-checks.
  }
}
