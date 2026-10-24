/** Domain operations over the shared message log. */

import { nowIso } from "./time.js";
import { isLive, type Message, type Session, type State } from "./types.js";

/** Grace period before a fully-consumed message becomes eligible for pruning. */
const RETAIN_MS = 60 * 60 * 1000;

/** Broadcast recipient. */
export const ALL = "all";

/** Appends a message and returns it, assigning the next sequence number. */
export function appendMessage(state: State, from: string, to: string, body: string): Message {
  state.seq += 1;
  const message: Message = { seq: state.seq, from, to, body, at: nowIso() };
  state.messages.push(message);
  return message;
}

/**
 * Messages a session has not yet consumed.
 *
 * Own messages are excluded, which is what makes a push signal and a
 * poll safe to combine: a session is never woken by its own write.
 */
export function unreadFor(state: State, session: Session): Message[] {
  return state.messages.filter(
    (m) => m.seq > session.cursor && m.from !== session.id && (m.to === session.id || m.to === ALL)
  );
}

/**
 * Advances the cursor. Delivery is cursor-mediated rather than
 * destructive, so a broadcast can be consumed once per recipient and a
 * duplicate poll returns nothing (SPEC.md §1).
 */
export function markRead(state: State, session: Session, upto: number): void {
  if (upto > session.cursor) session.cursor = upto;
}

/**
 * Drops messages every live session has consumed and that are past the
 * retention window, so a session joining later still sees recent history.
 */
export function pruneMessages(state: State): void {
  const live = Object.values(state.sessions).filter((s) => isLive(s));
  const minCursor = live.length === 0 ? Infinity : Math.min(...live.map((s) => s.cursor));
  const cutoff = Date.now() - RETAIN_MS;

  state.messages = state.messages.filter(
    (m) => m.seq > minCursor || Date.parse(m.at) > cutoff
  );
}
