#!/usr/bin/env npx tsx
/** Runs every fyi test suite and reports the combined result. */

import { failures } from "./harness.js";
import { run as items } from "./items.test.js";
import { run as views } from "./views.test.js";
import { run as archiving } from "./archiving.test.js";
import { run as freshness } from "./freshness.test.js";
import { run as handedit } from "./handedit.test.js";
import { run as identity } from "./identity.test.js";
import { run as where } from "./where.test.js";
import { run as refs } from "./refs.test.js";
import { run as listops } from "./listops.test.js";
import { run as checker } from "./check.test.js";
import { run as config } from "./config.test.js";

console.log("fyi tests");

for (const suite of [items, views, archiving, freshness, handedit, identity, where, refs, listops, checker, config]) {
  await suite();
}

const failed = failures();
console.log(failed === 0 ? "\nall passed" : `\n${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
