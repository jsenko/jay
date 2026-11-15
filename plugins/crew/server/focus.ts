/**
 * Whether a session's focus still holds work back. A session sets focus
 * when the user starts working in it, and has no signal that they left,
 * so on its own focus would hold work back for hours: on 2 November eight
 * review jobs waited overnight behind a reviewer the user had left. So
 * focus holds only within a lapse of the user's last prompt, or of
 * focus being set, whichever is later (SPEC.md §4). The status itself
 * is never rewritten: when the user writes again, focus holds again.
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Plain JavaScript, shared with the prompt hook and the opencode entry.
import { lastActivity } from "../activity/file.mjs";
import type { Session } from "./types.js";

/** How long focus holds without a prompt, unless configured. */
const DEFAULT_LAPSE_MIN = 30;

/** The user's jay settings, where `crew.focus_lapse_minutes` can change the lapse. */
const JAY_CONFIG = process.env.JAY_CONFIG || join(homedir(), ".jay", "config.json");

/** The lapse in ms, read once: from the environment for tests, then the config, then the default. */
const LAPSE_MS = (() => {
  const fromEnv = Number(process.env.CREW_FOCUS_LAPSE_MIN);
  if (fromEnv > 0) return fromEnv * 60_000;
  try {
    const configured = Number(JSON.parse(readFileSync(JAY_CONFIG, "utf8"))?.crew?.focus_lapse_minutes);
    if (configured > 0) return configured * 60_000;
  } catch {
    // No config, or not JSON: the default.
  }
  return DEFAULT_LAPSE_MIN * 60_000;
})();

/**
 * When the user last showed they were in the session: a prompt, or
 * setting focus. Focus set by a crew from before `focus_since` counts
 * from the session's last call instead, so it doesn't lapse at once.
 */
export function lastUserSign(session: Session): number {
  const set = Date.parse(session.focus_since ?? session.last_seen);
  const prompt = lastActivity(session.directory) as number | undefined;
  return prompt === undefined ? set : Math.max(prompt, set);
}

/** Whether the session is in focus and the user has been there recently enough for it to hold. */
export function focusHolds(session: Session, now = Date.now()): boolean {
  if (session.status !== "focus") return false;
  return now - lastUserSign(session) < LAPSE_MS;
}

/** Whether the session says focus but the user has been gone longer than the lapse. */
export function focusLapsed(session: Session, now = Date.now()): boolean {
  return session.status === "focus" && !focusHolds(session, now);
}

/** Minutes since the user's last sign, for what a session is told. */
export function minutesSinceUser(session: Session, now = Date.now()): number {
  return Math.floor((now - lastUserSign(session)) / 60_000);
}
