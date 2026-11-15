/**
 * The roles a job can name: the role files sessions start from, in each
 * installed plugin and in the user's own folder. Checked at the call, as
 * capabilities are, since a misspelt role would otherwise only show up
 * as a job nobody ever takes.
 */

import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { ToolError } from "./errors.js";

/** jay's home, where `/crew:start` finds roles; overridable for tests. */
const JAY_DIR = process.env.JAY_DIR || join(homedir(), ".jay");

/** Role names in a folder of role files. */
function rolesIn(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3));
}

/** Every role a session can start as, read afresh: plugins come and go. */
export function knownRoles(): string[] {
  const pluginsDir = join(JAY_DIR, "plugins");
  const fromPlugins = existsSync(pluginsDir)
    ? readdirSync(pluginsDir).flatMap((p) => rolesIn(join(pluginsDir, p, "roles")))
    : [];
  return [...new Set([...fromPlugins, ...rolesIn(join(JAY_DIR, "roles"))])].sort();
}

/** Validates an optional role name against the roles on disk. */
export function validateRole(input: unknown): string | undefined {
  if (input === undefined) return undefined;
  const role = String(input);
  const known = knownRoles();
  if (!known.includes(role)) {
    throw new ToolError(`unknown role "${role}". Known: ${known.join(", ") || "none: no roles installed"}`);
  }
  return role;
}
