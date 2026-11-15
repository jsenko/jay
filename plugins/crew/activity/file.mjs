/**
 * When the user last wrote in a session, kept as one small file per
 * session directory. Written by the client's prompt hook, which knows
 * nothing of crew's state, and read by every crew server when routing,
 * so a session's focus can lapse once the user has gone (SPEC.md §4).
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Where crew keeps its state; the same override the server honours. */
const CREW_DIR = process.env.CREW_DIR || join(homedir(), ".jay", "crew");

/**
 * A directory as the server sees it, its working directory, which has
 * symlinks resolved (macOS's /var is one); the client may name it either way.
 */
function realPath(directory) {
  try {
    return realpathSync(directory);
  } catch {
    return directory;
  }
}

/**
 * The stamp for a directory. Hashed, since a path makes an awkward file
 * name; two sessions in one directory share it, which errs towards
 * keeping focus.
 */
export function activityFile(directory) {
  const key = createHash("sha256").update(realPath(directory)).digest("hex").slice(0, 16);
  return join(CREW_DIR, "activity", key);
}

/** Records that the user wrote in the session at `directory` just now. */
export function stampActivity(directory) {
  const file = activityFile(directory);
  mkdirSync(join(CREW_DIR, "activity"), { recursive: true });
  writeFileSync(file, new Date().toISOString());
}

/** When the user last wrote in the session at `directory`, in ms, or undefined if never. */
export function lastActivity(directory) {
  try {
    const at = Date.parse(readFileSync(activityFile(directory), "utf8"));
    return Number.isNaN(at) ? undefined : at;
  } catch {
    return undefined;
  }
}
