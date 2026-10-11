/**
 * Project folders: a place for a project's files that are not items,
 * such as plans, design notes and phase files.
 *
 * fyi owns the location so no other plugin has to know the store's
 * layout. A folder is named after the project id without its `project-`
 * prefix, which is where these folders already lived before fyi knew
 * about them. It is derived, never stored, so it cannot go stale.
 */

import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { FYI_DIR } from "./paths.js";
import type { StoredItem } from "./types.js";

/** Where a project's folder is, whether or not it exists yet. */
function folderPath(stored: StoredItem): string {
  return join(FYI_DIR, stored.scope, "projects", stored.item.id.replace(/^project-/, ""));
}

/**
 * A project's folder, created if the project is active and the folder is
 * missing. An archived project keeps a folder it already has but is not
 * given a new one. Undefined for anything that is not a project.
 */
export function projectFolder(stored: StoredItem): string | undefined {
  if (stored.item.type !== "project") return undefined;

  const path = folderPath(stored);
  if (existsSync(path)) return path;
  if (stored.item.archived) return undefined;

  mkdirSync(path, { recursive: true });
  return path;
}
