/**
 * The store's format version, and the hook future migrations run from.
 *
 * Each item file follows the schemas, and when they change incompatibly,
 * stores written before need migrating. `<store>/store.json` records the
 * format the store is in. At start the server runs any migrations past it,
 * in order, and records each. A store newer than this server is never
 * written to: an older fyi would write items the newer one then misreads.
 *
 * No migration exists yet; version 1 is the format as first published.
 * SPEC.md §11 says how to add one.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { ToolError } from "./errors.js";
import { FYI_DIR } from "./paths.js";

/** The format this server reads and writes. Raise it with each migration. */
export const STORE_VERSION = 1;

/** Where the store's format is recorded. */
export const VERSION_FILE = join(FYI_DIR, "store.json");

/** One step of the format, from `version - 1` to `version`. */
export interface Migration {
  version: number;
  /** One line on what changes, logged as it runs. */
  description: string;
  /** Rewrites the store. Must be safe to run again after a crash part-way. */
  run(): void;
}

/** Every migration, in version order, ending at `STORE_VERSION`. */
export const MIGRATIONS: Migration[] = [];

/** The recorded version, or undefined for a store from before versioning. */
function recordedVersion(): number | undefined {
  if (!existsSync(VERSION_FILE)) return undefined;
  const version = Number(JSON.parse(readFileSync(VERSION_FILE, "utf8")).version);
  if (!Number.isInteger(version) || version < 1) throw new Error(`${VERSION_FILE}: version must be a whole number from 1`);
  return version;
}

/** Records the store's version. */
function record(version: number): void {
  mkdirSync(FYI_DIR, { recursive: true });
  writeFileSync(VERSION_FILE, JSON.stringify({ version }, null, 2) + "\n");
}

/**
 * Brings the store to `STORE_VERSION`, at server start. A store without a
 * recorded version predates versioning, so it is in format 1. A newer
 * store is left alone; `writable` then refuses every write.
 */
export function prepareStore(migrations = MIGRATIONS, current = STORE_VERSION): void {
  const found = recordedVersion() ?? 1;
  if (found > current) return;
  for (const migration of migrations) {
    if (migration.version <= found) continue;
    console.error(`[fyi] migrating the store to format ${migration.version}: ${migration.description}`);
    migration.run();
    record(migration.version);
  }
  if (found < current && !migrations.some((m) => m.version === current)) {
    throw new Error(`no migration reaches format ${current} from ${found}`);
  }
  if (recordedVersion() !== current) record(current);
}

/** Why the store can't be written, once known; null when it can. */
let refusal: string | null | undefined;

/**
 * Whether this server may write the store. Checked lazily, so anything
 * writing through the store module, the dashboard included, is covered.
 */
export function writable(): boolean {
  if (refusal === undefined) {
    const found = recordedVersion();
    refusal = found !== undefined && found > STORE_VERSION
      ? `the fyi store at ${FYI_DIR} is in format ${found}, newer than this fyi reads (${STORE_VERSION}). Update the fyi plugin; until then it is read-only.`
      : null;
  }
  return refusal === null;
}

/** Throws the reason the store can't be written, if it can't. */
export function assertWritable(): void {
  if (!writable()) throw new ToolError(refusal!);
}
