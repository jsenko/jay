#!/usr/bin/env npx tsx
/**
 * One-time migration: renames mirrored items to ids built from their key.
 *
 * Before `x-fyi-key`, a pr was named after its title, so the same PR
 * could be captured twice and an event could not find its item without a
 * search. This renames each keyed item to the id capture would give it
 * now, and repoints every reference to it.
 *
 *   npx tsx migrations/key-ids.ts --dry-run
 *   npx tsx migrations/key-ids.ts
 *
 * Items sharing a key are reported, not merged — that needs a person.
 */

import { keyedId } from "../identity.js";
import { keyField, parseKey, type KeyParts } from "../keys.js";
import { rewriteRefs } from "../refs.js";
import { all, rename } from "../store.js";
import { ITEM_TYPES } from "../types.js";

const DRY = process.argv.includes("--dry-run");

let renamed = 0;

for (const type of ITEM_TYPES) {
  const field = keyField(type);
  if (!field) continue;

  const byKey = new Map<string, string[]>();
  const parts = new Map<string, KeyParts>();

  for (const stored of all(true).filter((s) => s.item.type === type)) {
    try {
      const p = parseKey(stored.item[field]);
      byKey.set(p.canonical, [...(byKey.get(p.canonical) ?? []), stored.item.id]);
      parts.set(stored.item.id, p);
    } catch {
      console.log(`  skip  ${stored.item.id}: no usable ${field}`);
    }
  }

  for (const [key, ids] of byKey) {
    if (ids.length > 1) {
      console.log(`  dup   ${key} is held by ${ids.join(", ")} — merge by hand`);
      continue;
    }

    const [id] = ids;
    const target = keyedId(type, parts.get(id)!);
    if (target === id) continue;

    console.log(`  ${DRY ? "would" : "move "} ${id} -> ${target}`);
    if (DRY) continue;

    rename(id, target);
    const changed = rewriteRefs(id, target);
    if (changed.length) console.log(`        references updated in ${changed.join(", ")}`);
    renamed++;
  }
}

console.log(DRY ? "dry run, nothing changed" : `${renamed} renamed`);
