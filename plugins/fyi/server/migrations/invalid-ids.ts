#!/usr/bin/env npx tsx
/**
 * One-time migration: renames items whose id breaks the id pattern.
 *
 * Ids are lowercase words joined by hyphens, because they are file names
 * and are typed in conversation. A few items carried over from the old
 * layout have others — `task-pr-lifecycle-3.2.x`. Each is renamed to the
 * slug of its id, and every reference to it follows.
 *
 *   npx tsx migrations/invalid-ids.ts --dry-run
 *   npx tsx migrations/invalid-ids.ts
 */

import { slug } from "../identity.js";
import { rewriteRefs } from "../refs.js";
import { all, exists, rename } from "../store.js";

const DRY = process.argv.includes("--dry-run");
const VALID = /^[a-z0-9][a-z0-9-]*$/;

let renamed = 0;
for (const stored of all(true)) {
  const { id } = stored.item;
  if (VALID.test(id)) continue;

  // No length cap: this keeps an existing name readable, it does not make one up.
  const target = slug(id, Infinity);
  if (exists(target)) {
    console.log(`  skip  ${id}: "${target}" is taken — rename by hand`);
    continue;
  }

  console.log(`  ${DRY ? "would" : "move "} ${id} -> ${target}`);
  if (DRY) continue;

  rename(id, target);
  const changed = rewriteRefs(id, target);
  if (changed.length) console.log(`        references updated in ${changed.join(", ")}`);
  renamed++;
}

console.log(DRY ? "dry run, nothing changed" : `${renamed} renamed`);
