/** Where items live on disk. */

import { homedir } from "node:os";
import { join } from "node:path";

import type { ItemType, Scope } from "./types.js";

/** Root of the store. Overridable so tests do not touch the real one. */
export const FYI_DIR = process.env.FYI_DIR || join(homedir(), ".fyi");

/** Directory holding every item of one type in one scope. */
export function typeDir(scope: Scope, type: ItemType): string {
  return join(FYI_DIR, scope, type);
}

/**
 * Where archived items live.
 *
 * Kept apart so the active scan stays small as the store grows over
 * years, which is what lets the index stay in memory without a database.
 */
export function archiveDir(scope: Scope, type: ItemType): string {
  return join(FYI_DIR, scope, "archive", type);
}

/** The file backing one item, active or archived. */
export function itemPath(scope: Scope, type: ItemType, id: string, archived = false): string {
  return join(archived ? archiveDir(scope, type) : typeDir(scope, type), `${id}.md`);
}
