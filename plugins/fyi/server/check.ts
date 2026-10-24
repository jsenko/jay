#!/usr/bin/env npx tsx
/**
 * Reports every item that no longer matches its schema.
 *
 * The server validates what it writes, but files outlive the schema they
 * were written under: a field gets renamed, a hand edit adds a typo, an
 * old item predates a required field. Nothing reads them closely enough
 * to notice until a tool refuses to update one. Run this after changing
 * a schema to see what needs migrating.
 *
 *   npm run check
 *
 * Reads the files directly rather than through the store, because every
 * store read also archives whatever is due — a check must change nothing.
 * Exits 1 when anything is reported.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { toItem } from "./frontmatter.js";
import { keyField, keyIdCandidates, parseKey } from "./keys.js";
import { archiveDir, FYI_DIR, typeDir } from "./paths.js";
import { refProblems } from "./refs.js";
import { problems } from "./schema.js";
import { scopeDirs } from "./scopes.js";
import { ITEM_TYPES, type Item, type ItemType, type Scope } from "./types.js";

/** One file as found on disk. */
interface Found {
  path: string;
  scope: Scope;
  type: ItemType;
  archivedDir: boolean;
  item: Item | null;
}

/** Every item file in the store, parsed or not. */
function scan(): Found[] {
  const out: Found[] = [];
  for (const scope of scopeDirs()) {
    for (const type of ITEM_TYPES) {
      for (const [dir, archivedDir] of [[typeDir(scope, type), false], [archiveDir(scope, type), true]] as const) {
        if (!existsSync(dir)) continue;
        for (const file of readdirSync(dir).filter((f) => f.endsWith(".md"))) {
          const path = join(dir, file);
          let item: Item | null = null;
          try {
            item = toItem(readFileSync(path, "utf8"), type);
          } catch {
            // Reported below as unparseable.
          }
          out.push({ path, scope, type, archivedDir, item });
        }
      }
    }
  }
  return out;
}

const found = scan();
const types = new Map(found.filter((f) => f.item?.id).map((f) => [String(f.item!.id), String(f.item!.type)]));
const report = new Map<string, string[]>();

/** Records one problem against a file. */
function flag(f: Found, problem: string): void {
  const key = relative(FYI_DIR, f.path);
  report.set(key, [...(report.get(key) ?? []), problem]);
}

for (const f of found) {
  const item = f.item;
  if (!item?.id || !item.type) {
    flag(f, "cannot be read: no frontmatter, or no id or type");
    continue;
  }

  const file = f.path.split("/").at(-1)!.slice(0, -3);
  if (item.id !== file) flag(f, `id "${item.id}" does not match the file name`);
  if (item.type !== f.type) flag(f, `type "${item.type}" is in the ${f.type} directory`);
  if ((item.archived === true) !== f.archivedDir) {
    flag(f, item.archived ? "marked archived but in the active directory" : "in the archive but not marked archived");
  }

  for (const p of problems(f.type, item)) flag(f, p);
  for (const p of refProblems(f.type, item, (id) => types.get(id))) flag(f, p);
}

// Mirrored items: one item per key, named as capture would name it.
for (const type of ITEM_TYPES) {
  const field = keyField(type);
  if (!field) continue;

  const byKey = new Map<string, Found[]>();
  for (const f of found.filter((x) => x.type === type && x.item?.id)) {
    try {
      const canonical = parseKey(f.item![field]).canonical;
      byKey.set(canonical, [...(byKey.get(canonical) ?? []), f]);
    } catch {
      // A missing or malformed key is already reported by the schema check.
    }
  }

  for (const [key, holders] of byKey) {
    if (holders.length > 1) {
      for (const f of holders) flag(f, `${key} is also held by ${holders.filter((h) => h !== f).map((h) => h.item!.id).join(", ")}`);
      continue;
    }
    const [f] = holders;
    const expected = keyIdCandidates(type, parseKey(f.item![field])).find((id) => !types.has(id) || id === f.item!.id);
    if (expected && expected !== f.item!.id) flag(f, `named "${f.item!.id}", capture would name it "${expected}"`);
  }
}

for (const [path, list] of [...report].sort(([a], [b]) => a.localeCompare(b))) {
  console.log(path);
  for (const p of list) console.log(`  - ${p}`);
}
console.log(report.size === 0 ? `${found.length} items, all valid` : `\n${report.size} of ${found.length} items have problems`);
process.exit(report.size === 0 ? 0 : 1);
