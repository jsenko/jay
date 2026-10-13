/**
 * Locked read-modify-write over the shared state file. Every crew
 * mutation goes through `mutate`. See SPEC.md §1.
 */

import { existsSync, mkdirSync, openSync, closeSync, readFileSync, writeFileSync, renameSync, unlinkSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { ToolError } from "./errors.js";
import { emptyState, STATE_VERSION, type State } from "./types.js";

const CREW_DIR = process.env.CREW_DIR || join(homedir(), ".jay", "crew");
const STATE_FILE = join(CREW_DIR, "state.json");
const LOCK_FILE = join(CREW_DIR, "state.lock");

/** A lock older than this is assumed abandoned by a killed process. */
const LOCK_STALE_MS = 10_000;
const LOCK_TIMEOUT_MS = 5_000;
const LOCK_RETRY_MS = 20;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Exclusive-create locking. Node has no flock, and an O_EXCL lockfile is
 * sufficient here: contention is a handful of sessions, and a lock left
 * behind by SIGKILL is broken on age rather than stranding the board.
 */
async function acquireLock(): Promise<void> {
  const deadline = Date.now() + LOCK_TIMEOUT_MS;

  for (;;) {
    try {
      closeSync(openSync(LOCK_FILE, "wx"));
      return;
    } catch (err: any) {
      if (err.code !== "EEXIST") throw err;

      try {
        if (Date.now() - statSync(LOCK_FILE).mtimeMs > LOCK_STALE_MS) {
          unlinkSync(LOCK_FILE);
          continue;
        }
      } catch {
        // Holder released it between our open and stat — just retry.
      }

      if (Date.now() > deadline) {
        throw new Error(`crew: timed out waiting for ${LOCK_FILE}`);
      }
      await sleep(LOCK_RETRY_MS);
    }
  }
}

function releaseLock(): void {
  try {
    unlinkSync(LOCK_FILE);
  } catch {
    // Already gone; nothing to do.
  }
}

/**
 * Crew state is operational and reconstructible, so a missing, corrupt or
 * older file starts over rather than blocking a session (SPEC.md §5). A
 * newer one is refused: this crew can't read it, and writing over it
 * would destroy the state of the crew that wrote it.
 */
function readState(): State {
  if (!existsSync(STATE_FILE)) return emptyState();
  let parsed: State;
  try {
    parsed = JSON.parse(readFileSync(STATE_FILE, "utf8")) as State;
  } catch (err: any) {
    console.error(`[crew] discarding unreadable state (${err.message})`);
    return emptyState();
  }
  const version = Number(parsed.version);
  if (version > STATE_VERSION) {
    throw new ToolError(`${STATE_FILE} is from a newer crew (format ${version}; this one reads ${STATE_VERSION}). Update the crew plugin.`);
  }
  if (version !== STATE_VERSION) {
    console.error(`[crew] starting fresh: state format ${parsed.version} is older than ${STATE_VERSION}`);
    return emptyState();
  }
  return parsed;
}

function writeState(state: State): void {
  const tmp = `${STATE_FILE}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2));
  renameSync(tmp, STATE_FILE);
}

/** Creates the state directory, which a fresh install does not have yet. */
export function ensureDir(): void {
  if (!existsSync(CREW_DIR)) mkdirSync(CREW_DIR, { recursive: true });
}

/** Read state, apply `fn`, persist. Returns whatever `fn` returns. */
export async function mutate<T>(fn: (state: State) => T): Promise<T> {
  ensureDir();
  await acquireLock();
  try {
    const state = readState();
    const result = fn(state);
    writeState(state);
    return result;
  } finally {
    releaseLock();
  }
}

/** Read without locking — callers must not retain or mutate the result. */
export function read(): State {
  ensureDir();
  return readState();
}

export const paths = { CREW_DIR, STATE_FILE, LOCK_FILE };
