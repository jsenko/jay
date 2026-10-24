/**
 * Scopes: the directories under the store's root that hold items. Any
 * such directory is a scope, so a user's own scopes need no setting.
 */

import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { ToolError } from "./errors.js";
import { FYI_DIR } from "./paths.js";
import { assertWritable } from "./store-version.js";
import type { Scope } from "./types.js";

/**
 * Scopes every store has, whether or not their directories exist yet:
 * fyi's rules send a personal errand to `personal` in any store.
 */
export const BUILT_IN_SCOPES: readonly Scope[] = ["default", "personal", "work"];

/** Directories in the root that hold something else; `all` is search's word for every scope. */
const RESERVED = new Set(["all", "attachments"]);

/** Lowercase and hyphens, like ids, so a scope is also a safe directory name. */
const NAME = /^[a-z0-9][a-z0-9-]{0,39}$/;

/** Whether `name` could be a scope: a valid name that isn't reserved. */
export function isScopeName(name: unknown): name is Scope {
  return typeof name === "string" && NAME.test(name) && !RESERVED.has(name);
}

/** The scope directories that exist, sorted. Dot-directories, such as `.git`, never count. */
export function scopeDirs(): Scope[] {
  if (!existsSync(FYI_DIR)) return [];
  return readdirSync(FYI_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && isScopeName(entry.name))
    .map((entry) => entry.name)
    .sort();
}

/** Creates a scope's directory, refusing a name that can't be one. Creating one that exists is fine. */
export function createScope(name: unknown): Scope {
  if (!isScopeName(name)) {
    throw new ToolError(
      `"${name}" can't be a scope: use lowercase letters, digits and hyphens, at most 40, and not ${[...RESERVED].join(" or ")}`
    );
  }
  assertWritable();
  mkdirSync(join(FYI_DIR, name), { recursive: true });
  return name;
}
