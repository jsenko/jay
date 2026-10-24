/**
 * The item store: markdown on disk, an index in memory.
 *
 * Writes go through immediately — never cache-and-flush. Deferred writes
 * would break hand-editability, which is the whole reason for choosing
 * markdown, and open a window where the file and the server disagree.
 *
 * Active and archived items live in separate directories. The active set
 * is scanned on every call; the archive only when something asks for it,
 * so the hot path stays small however long the store has been running.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { toFile, toItem } from "./frontmatter.js";
import { archiveDir, FYI_DIR, itemPath, typeDir } from "./paths.js";
import { shouldArchive } from "./archiving.js";
import { assertWritable, writable } from "./store-version.js";
import { nowIso } from "./time.js";
import { scopeDirs } from "./scopes.js";
import { ITEM_TYPES, type Item, type ItemType, type Scope, type StoredItem } from "./types.js";

interface Entry extends StoredItem {
  mtimeMs: number;
}

const active = new Map<string, Entry>();
const archive = new Map<string, Entry>();
let archiveLoaded = false;

/** Reads one file into an item, or null when it cannot be parsed. */
function readItem(path: string, scope: Scope, type: ItemType): Entry | null {
  try {
    const item = toItem(readFileSync(path, "utf8"), type);
    if (!item.id || !item.type) return null;
    return { item, scope, path, mtimeMs: statSync(path).mtimeMs };
  } catch {
    // A file being written, or hand-edited into something unparseable.
    // Skipped rather than fatal: one bad file must not hide the rest.
    return null;
  }
}

/** Scans one directory into a map, reparsing only what changed. */
function scanInto(map: Map<string, Entry>, dir: string, scope: Scope, type: ItemType, seen: Set<string>): void {
  if (!existsSync(dir)) return;

  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".md")) continue;
    const path = join(dir, file);
    const id = file.slice(0, -3);
    seen.add(id);

    let mtime: number;
    try {
      mtime = statSync(path).mtimeMs;
    } catch {
      continue;
    }

    const known = map.get(id);
    if (known && known.mtimeMs === mtime && known.path === path) continue;

    const entry = readItem(path, scope, type);
    if (entry) map.set(id, entry);
  }
}

/**
 * Rebuilds the active index from disk and archives anything that has
 * finished and sat finished long enough.
 *
 * Called at the start of every operation: at this size a full stat pass
 * is sub-millisecond, so a hand edit is visible on the next call and
 * archiving happens continuously rather than waiting for a cleanup.
 */
export function refresh(): void {
  const seen = new Set<string>();

  for (const scope of scopeDirs()) {
    for (const type of ITEM_TYPES) {
      scanInto(active, typeDir(scope, type), scope, type, seen);
    }
  }

  for (const id of [...active.keys()]) {
    if (!seen.has(id)) active.delete(id);
  }

  sweep();
}

/** Loads the archive, which is otherwise left alone. */
function loadArchive(): void {
  const seen = new Set<string>();
  for (const scope of scopeDirs()) {
    for (const type of ITEM_TYPES) {
      scanInto(archive, archiveDir(scope, type), scope, type, seen);
    }
  }
  for (const id of [...archive.keys()]) {
    if (!seen.has(id)) archive.delete(id);
  }
  archiveLoaded = true;
}

/** An item by id from either set, loading the archive only if needed. */
function lookup(id: string): Item | undefined {
  const found = active.get(id);
  if (found) return found.item;
  if (!archiveLoaded) loadArchive();
  return archive.get(id)?.item;
}

/** Archives every active item whose policy says its time is up. */
function sweep(now = Date.now()): void {
  // Archiving writes, so it waits while the store is newer than this server.
  if (!writable()) return;
  for (const entry of [...active.values()]) {
    if (shouldArchive(entry.item, lookup, now)) moveToArchive(entry);
  }
}

/** Moves one item into the archive, stamping when it happened. */
function moveToArchive(entry: Entry): void {
  entry.item.archived = true;
  entry.item.archived_at = nowIso();

  const target = itemPath(entry.scope, entry.item.type, entry.item.id, true);
  mkdirSync(archiveDir(entry.scope, entry.item.type), { recursive: true });
  writeFileSync(target, toFile(entry.item));
  rmSync(entry.path, { force: true });

  active.delete(entry.item.id);
  archive.set(entry.item.id, { ...entry, path: target, mtimeMs: statSync(target).mtimeMs });
}

/** One item by id, searching the archive only if it is not active. */
export function get(id: string): StoredItem | undefined {
  refresh();
  const found = active.get(id);
  if (found) return found;

  if (!archiveLoaded) loadArchive();
  return archive.get(id);
}

/** Active items. Pass true to include archived ones. */
export function all(includeArchived = false): StoredItem[] {
  refresh();
  if (!includeArchived) return [...active.values()];

  loadArchive();
  return [...active.values(), ...archive.values()];
}

/** Whether an id is taken, in either set. */
export function exists(id: string): boolean {
  refresh();
  if (active.has(id)) return true;
  if (!archiveLoaded) loadArchive();
  return archive.has(id);
}

/**
 * Writes an item, creating or replacing its file.
 *
 * Written to a temporary file and renamed, so a reader never sees a
 * half-written item. An item archived by hand moves directory here, so
 * setting `archived: true` through `fyi_update` behaves the same as
 * being archived by policy.
 */
export function write(item: Item, scope: Scope): StoredItem {
  assertWritable();
  const archived = item.archived === true;
  const dir = archived ? archiveDir(scope, item.type) : typeDir(scope, item.type);
  mkdirSync(dir, { recursive: true });

  const path = itemPath(scope, item.type, item.id, archived);
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, toFile(item));
  renameSync(tmp, path);

  const other = itemPath(scope, item.type, item.id, !archived);
  if (existsSync(other)) rmSync(other, { force: true });

  const entry: Entry = { item, scope, path, mtimeMs: statSync(path).mtimeMs };
  if (archived) {
    active.delete(item.id);
    archive.set(item.id, entry);
  } else {
    archive.delete(item.id);
    active.set(item.id, entry);
  }
  return entry;
}

/**
 * Gives an item a new id: writes it under the new name, then removes the
 * old file. References elsewhere are the caller's to rewrite — see
 * `refs.ts` — since the store does not know which fields hold ids.
 */
export function rename(id: string, newId: string): StoredItem {
  const stored = get(id);
  if (!stored) throw new Error(`no item with id "${id}"`);
  if (exists(newId)) throw new Error(`"${newId}" is already taken`);

  const moved = write({ ...stored.item, id: newId }, stored.scope);
  rmSync(stored.path, { force: true });
  active.delete(id);
  archive.delete(id);
  return moved;
}

/** Where the store lives, for diagnostics. */
export const root = FYI_DIR;
