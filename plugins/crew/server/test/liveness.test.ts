/** Liveness: a running session stays routable without making calls. */

import { call, check, connect, editState, hoursAgo, section, settle, tempCrewDir, tempWorkDir } from "./harness.js";

/**
 * A session waiting quietly for a push keeps getting work, while one whose
 * heartbeat has stopped, as after SIGKILL, still goes stale.
 */
export async function run(): Promise<void> {
  section("liveness");

  const crewDir = tempCrewDir("liveness");
  const watcher = await connect(tempWorkDir(), crewDir);
  const quiet = await connect(tempWorkDir(), crewDir, { CREW_HEARTBEAT_MS: "200" });
  const dead = await connect(tempWorkDir(), crewDir);

  await call(watcher, "crew_join", { purpose: "Watching GitHub events", capabilities: ["watch"] });
  const quietId = (await call(quiet, "crew_join", { purpose: "Reviewing quietly", capabilities: ["review"] })).session_id;
  const deadId = (await call(dead, "crew_join", { purpose: "Reviewing then killed", capabilities: ["review"] })).session_id;

  editState(crewDir, (state) => {
    state.sessions[quietId].last_seen = hoursAgo(2);
    state.sessions[deadId].last_seen = hoursAgo(2);
  });
  await settle(800);

  const posted = await call(watcher, "crew_post", { body: "Review PR 8676", needs: ["review"] });
  check("a quiet session is still offered work", posted.eligible_sessions.includes(quietId), posted.eligible_sessions);
  check("a session with no heartbeat goes stale", !posted.eligible_sessions.includes(deadId), posted.eligible_sessions);

  await Promise.all([watcher.close(), quiet.close(), dead.close()]);
}
