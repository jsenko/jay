/**
 * fyi's settings, from config.json in the store's root. Kept with the store, so
 * FYI_DIR moves the data and its settings together. Read once, at start.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ToolError } from "./errors.js";
import { FYI_DIR } from "./paths.js";
import { BUILT_IN_SCOPES, isScopeName, scopeDirs } from "./scopes.js";
import type { Scope } from "./types.js";

/** The settings file. */
export const CONFIG_FILE = join(FYI_DIR, "config.json");

const FALLBACK_SCOPE: Scope = "default";

/**
 * Reads `defaultScope`. A missing file or setting means the fallback. A value that
 * is neither a built-in scope nor an existing one stops the server: a typo would
 * otherwise start a new scope and quietly write items there, which is worse than a
 * server that will not start.
 */
function readDefaultScope(): Scope {
  let config: any;
  try {
    config = JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
  } catch (e: any) {
    if (e.code === "ENOENT") return FALLBACK_SCOPE;
    throw new Error(`cannot read ${CONFIG_FILE}: ${e.message}`);
  }
  const scope = config?.defaultScope;
  if (scope === undefined) return FALLBACK_SCOPE;
  const known = [...new Set([...BUILT_IN_SCOPES, ...scopeDirs()])].sort();
  if (!isScopeName(scope) || !known.includes(scope)) {
    throw new Error(`${CONFIG_FILE}: defaultScope is "${scope}", but must be one of ${known.join(", ")}`);
  }
  return scope;
}

/** The scope a call uses when it names none. */
export const DEFAULT_SCOPE: Scope = readDefaultScope();

/** Every scope a call may name: the built-in ones, the directories that exist, and the default. */
export function knownScopes(): Scope[] {
  return [...new Set([...BUILT_IN_SCOPES, ...scopeDirs(), DEFAULT_SCOPE])].sort();
}

/** Refuses a scope that doesn't exist, naming those that do, so a typo is never a new scope. */
export function requireScope(scope: unknown): Scope {
  const known = knownScopes();
  if (typeof scope !== "string" || !known.includes(scope)) {
    throw new ToolError(`no scope "${scope}"; the scopes are ${known.join(", ")}. fyi_create_scope adds one`);
  }
  return scope;
}

/**
 * What a read asks for: one scope, several, or `"all"`. Nothing named
 * means the default scope.
 */
export function requireScopes(input: unknown): Scope[] | "all" {
  if (input === undefined) return [DEFAULT_SCOPE];
  if (input === "all") return "all";
  return (Array.isArray(input) ? input : [input]).map(requireScope);
}

/** The schema for a read's `scope`, listing the scopes as the server started. */
export function scopesInputSchema(): Record<string, unknown> {
  return {
    anyOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
    description: `Which scopes to look in: one, a list, or "all". The scopes are ${knownScopes().join(", ")}. Defaults to ${DEFAULT_SCOPE}; use more only when the question genuinely spans them.`,
  };
}
