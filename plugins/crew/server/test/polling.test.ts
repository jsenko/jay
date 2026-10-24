/** Polling: the suggested interval grows while idle and resets on activity. */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { call, check, connect, section, tempCrewDir, tempWorkDir } from "./harness.js";

/** The default bounds, then bounds from `~/.jay/config.json`. */
export async function run(): Promise<void> {
  section("polling");

  const crewDir = tempCrewDir("polling");
  const sender = await connect(tempWorkDir(), crewDir);
  const idle = await connect(tempWorkDir(), crewDir);
  await call(sender, "crew_join", { purpose: "Sending", capabilities: ["code"] });
  const idleId = (await call(idle, "crew_join", { purpose: "Waiting", capabilities: ["review"] })).session_id;

  const intervals: number[] = [];
  for (let i = 0; i < 6; i++) intervals.push((await call(idle, "crew_poll")).next_poll_minutes);
  check("empty polls grow by ten minutes up to an hour", JSON.stringify(intervals) === "[20,30,40,50,60,60]", intervals);

  await call(sender, "crew_send", { to: idleId, body: "something happened" });
  check("activity resets the interval", (await call(idle, "crew_poll")).next_poll_minutes === 10);

  const config = join(tempWorkDir(), "config.json");
  writeFileSync(config, JSON.stringify({ polling: { min: 5, step: 5, max: 12 } }));
  const tuned = await connect(tempWorkDir(), crewDir, { JAY_CONFIG: config });
  await call(tuned, "crew_join", { purpose: "Tuned", capabilities: ["docs"] });
  const tunedIntervals: number[] = [];
  for (let i = 0; i < 3; i++) tunedIntervals.push((await call(tuned, "crew_poll")).next_poll_minutes);
  check("the bounds come from the config", JSON.stringify(tunedIntervals) === "[10,12,12]", tunedIntervals);

  await Promise.all([sender.close(), idle.close(), tuned.close()]);
}
