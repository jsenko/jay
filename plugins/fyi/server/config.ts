/**
 * fyi's settings, from config.json in the store's root. Kept with the store, so
 * FYI_DIR moves the data and its settings together. Read once, at start.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { FYI_DIR } from "./paths.js";
import { SCOPES, type Scope } from "./types.js";

/** The settings file. */
export const CONFIG_FILE = join(FYI_DIR, "config.json");

const FALLBACK_SCOPE: Scope = "default";

/**
 * Reads `defaultScope`. A missing file or setting means the fallback; a value that
 * is not a scope stops the server, since quietly writing items to another store is
 * worse than a server that will not start.
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
  if (!(SCOPES as readonly string[]).includes(scope)) {
    throw new Error(`${CONFIG_FILE}: defaultScope is "${scope}", but must be one of ${SCOPES.join(", ")}`);
  }
  return scope;
}

/** The scope a call uses when it names none. */
export const DEFAULT_SCOPE: Scope = readDefaultScope();
