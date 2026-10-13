/** The state file's format version: older starts fresh, newer is refused. */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { call, check, connect, section, tempCrewDir, tempWorkDir } from "./harness.js";

/**
 * Crews of different versions can share a state file, from Claude Code and
 * opencode on different releases. An older crew must not overwrite what a
 * newer one wrote.
 */
export async function run(): Promise<void> {
  section("state version");

  const older = tempCrewDir("version-old");
  writeFileSync(join(older, "state.json"), JSON.stringify({
    version: 0, seq: 3, sessions: { gone: { id: "gone" } }, messages: [], jobs: {}, known_ids: {},
  }));
  const a = await connect(tempWorkDir(), older);
  const joined = await call(a, "crew_join", { purpose: "after an upgrade" });
  check("an older state starts fresh", typeof joined.session_id === "string" && joined.others.length === 0, joined);
  check("and is written in the current format", JSON.parse(readFileSync(join(older, "state.json"), "utf8")).version === 1);
  await a.close();

  const newer = tempCrewDir("version-new");
  const future = JSON.stringify({ version: 99, seq: 7, sessions: {}, messages: [], jobs: {}, known_ids: {} });
  writeFileSync(join(newer, "state.json"), future);
  const b = await connect(tempWorkDir(), newer);
  const refused = await call(b, "crew_join", { purpose: "on an old crew" });
  check("a newer state is refused, saying to update", typeof refused.error === "string" && refused.error.includes("Update the crew plugin"), refused);
  check("and left as it was", readFileSync(join(newer, "state.json"), "utf8") === future);
  await b.close();
}
