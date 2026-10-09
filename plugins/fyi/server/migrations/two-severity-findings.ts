#!/usr/bin/env npx tsx
/**
 * One-time migration: PR findings from three severities to two.
 *
 * Findings were once `must/should/nice`, and the middle bucket carried no
 * information — the author's decision is whether a finding blocks merge.
 * `required/optional` keeps the first count and folds the other two
 * together: `0/1/0` becomes `0/1`.
 *
 *   npx tsx migrations/two-severity-findings.ts --dry-run
 *   npx tsx migrations/two-severity-findings.ts
 */

import { all, write } from "../store.js";

const DRY = process.argv.includes("--dry-run");
const THREE = /^(\d+)\/(\d+)\/(\d+)$/;

let changed = 0;
for (const stored of all(true).filter((s) => s.item.type === "pr")) {
  const match = THREE.exec(String(stored.item.findings ?? ""));
  if (!match) continue;

  const [, must, should, nice] = match.map(Number);
  const next = `${must}/${should + nice}`;
  console.log(`  ${DRY ? "would" : "set  "} ${stored.item.id}: ${stored.item.findings} -> ${next}`);
  if (DRY) continue;

  write({ ...stored.item, findings: next }, stored.scope);
  changed++;
}

console.log(DRY ? "dry run, nothing changed" : `${changed} updated`);
