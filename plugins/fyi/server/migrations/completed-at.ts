#!/usr/bin/env npx tsx
/**
 * One-time migration: gives finished items a `completed_at`.
 *
 * Items finished before the field existed have no record of when. Their
 * last edit is the best estimate there is, and the same one archiving
 * already used, so a search on completed_at covers them too.
 *
 *   npx tsx migrations/completed-at.ts --dry-run
 *   npx tsx migrations/completed-at.ts
 *
 * Archived items are included. Running it again changes nothing.
 */

import { isFinished } from "../completion.js";
import { all, write } from "../store.js";

const DRY = process.argv.includes("--dry-run");

let stamped = 0;

for (const { item, scope } of all(true)) {
  if (item.completed_at !== undefined || !isFinished(item)) continue;

  console.log(`  ${DRY ? "would" : "stamp"} ${item.id}: ${item.updated_at}`);
  if (DRY) continue;

  write({ ...item, completed_at: item.updated_at }, scope);
  stamped++;
}

console.log(DRY ? "dry run, nothing changed" : `${stamped} stamped`);
