/** The event cache: bounded, and each event handed out once. */

import { Cache } from "../cache.js";
import { check, section } from "./harness.js";

/** A cache that grows without bound is a memory leak in a server that runs for weeks. */
export async function run(): Promise<void> {
  section("cache");

  const cache = new Cache();
  const event = (n: number) => ({ type: "IssuesEvent", timestamp: `t${n}`, body: "" }) as any;
  for (let n = 1; n <= 101; n++) cache.setEvent(String(n), event(n));

  check("it keeps at most 100 events", cache.getEventCount() === 100, cache.getEventCount());
  check("dropping the oldest", cache.getEvent("1") === undefined && cache.getEvent("101") !== undefined);
  check("the oldest left is reported for coverage", cache.getOldestEventTimestamp() === "t2", cache.getOldestEventTimestamp());

  check("new events are handed out once", cache.consumeNewEvents().length === 100 && cache.consumeNewEvents().length === 0);
}
