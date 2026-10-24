#!/usr/bin/env npx tsx
/** Runs every crew test suite and reports the combined result. */

import { failures } from "./harness.js";
import { run as registry } from "./registry.test.js";
import { run as messaging } from "./messaging.test.js";
import { run as queue } from "./queue.test.js";
import { run as locking } from "./locking.test.js";
import { run as version } from "./version.test.js";
import { run as liveness } from "./liveness.test.js";
import { run as retention } from "./retention.test.js";
import { run as waiting } from "./waiting.test.js";
import { run as polling } from "./polling.test.js";

console.log("crew tests");

for (const suite of [registry, messaging, queue, locking, version, liveness, retention, waiting, polling]) {
  await suite();
}

const failed = failures();
console.log(failed === 0 ? "\nall passed" : `\n${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
