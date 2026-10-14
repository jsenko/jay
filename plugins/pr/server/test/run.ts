/** Runs every pr test suite and reports the combined result. */

import { failures } from "./harness.js";
import { run as cache } from "./cache.test.js";
import { run as events } from "./events.test.js";
import { run as notifications } from "./notifications.test.js";

console.log("pr tests");

for (const suite of [cache, events, notifications]) {
  await suite();
}

const failed = failures();
console.log(failed === 0 ? "\nall passed" : `\n${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
