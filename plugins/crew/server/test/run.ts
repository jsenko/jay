#!/usr/bin/env npx tsx
/** Runs every crew test suite and reports the combined result. */

import { failures } from "./harness.js";
import { run as registry } from "./registry.test.js";
import { run as messaging } from "./messaging.test.js";
import { run as queue } from "./queue.test.js";
import { run as locking } from "./locking.test.js";

console.log("crew tests");

for (const suite of [registry, messaging, queue, locking]) {
  await suite();
}

const failed = failures();
console.log(failed === 0 ? "\nall passed" : `\n${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
