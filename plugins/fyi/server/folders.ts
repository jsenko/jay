/**
 * Project folders: a place for a project's files that are not items,
 * such as plans, design notes and phase files.
 *
 * fyi owns the location so no other plugin has to know the store's
 * layout. A folder is named after the project id without its `project-`
 * prefix, which is where these folders already lived before fyi knew
 * about them. It is derived, never stored, so it cannot go stale.
 */

import { existsSync, lstatSync, mkdirSync, realpathSync, renameSync, symlinkSync, unlinkSync } from "node:fs";
import { join } from "node:path";

import { ToolError } from "./errors.js";

import { FYI_DIR } from "./paths.js";
import type { Scope, StoredItem } from "./types.js";

/** Where a project's folder is in a scope, whether or not it exists yet. */
function folderPath(stored: StoredItem, scope: Scope = stored.scope): string {
  return join(FYI_DIR, scope, "projects", stored.item.id.replace(/^project-/, ""));
}

/** Whether `path` is the link an earlier move left, pointing back at `folder`. */
function isLinkTo(path: string, folder: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink() && realpathSync(path) === realpathSync(folder);
  } catch {
    return false;
  }
}

/**
 * Refuses a move that would land a project's folder on one already
 * there. The link an earlier move left is not in the way: moving back
 * replaces it.
 */
export function checkFolderMove(stored: StoredItem, scope: Scope): void {
  if (stored.item.type !== "project") return;
  const [source, target] = [folderPath(stored), folderPath(stored, scope)];
  if (existsSync(source) && existsSync(target) && !isLinkTo(target, source)) {
    throw new ToolError(`${target} already exists; move or remove it first`);
  }
}

/**
 * Moves a project's folder with it to another scope, leaving a link at
 * the old path, so checkouts linked to the folder and paths recorded in
 * notes keep working. Nothing to do without a folder.
 */
export function moveFolder(from: StoredItem, scope: Scope): string | undefined {
  if (from.item.type !== "project" || !existsSync(folderPath(from))) return undefined;
  const [source, target] = [folderPath(from), folderPath(from, scope)];
  if (isLinkTo(target, source)) unlinkSync(target);
  mkdirSync(join(FYI_DIR, scope, "projects"), { recursive: true });
  renameSync(source, target);
  symlinkSync(target, source);
  return target;
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
