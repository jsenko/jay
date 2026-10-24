/** Retention: ended jobs and read messages leave the state on their own. */

import { call, check, connect, editState, hoursAgo, section, tempCrewDir, tempWorkDir } from "./harness.js";

/**
 * Every ended job is pruned an hour after it ended, whatever its final
 * state, and a dead session's cursor no longer holds messages back.
 */
export async function run(): Promise<void> {
  section("retention");

  const crewDir = tempCrewDir("retention");
  const watcher = await connect(tempWorkDir(), crewDir);
  const reviewer = await connect(tempWorkDir(), crewDir);
  const dead = await connect(tempWorkDir(), crewDir);

  await call(watcher, "crew_join", { purpose: "Watching GitHub events", capabilities: ["watch"] });
  const reviewerId = (await call(reviewer, "crew_join", { purpose: "Reviewing PRs", capabilities: ["review"] })).session_id;
  const deadId = (await call(dead, "crew_join", { purpose: "Reviewing then killed", capabilities: ["review"] })).session_id;

  const expired = (await call(watcher, "crew_post", { body: "Cut a release", needs: ["release"], expires_in: 0.001 })).job_id;
  const recent = (await call(watcher, "crew_post", { body: "Cut another", needs: ["release"], expires_in: 0.001 })).job_id;
  const legacy = (await call(watcher, "crew_post", { body: "Old expired job", needs: ["release"] })).job_id;
  const done = (await call(watcher, "crew_post", { body: "Review PR 1", needs: ["review"], to: reviewerId })).job_id;
  await call(reviewer, "crew_claim", { job_id: done });
  await call(reviewer, "crew_resolve", { job_id: done, outcome: "done" });

  await call(watcher, "crew_send", { to: "all", body: "an old broadcast" });
  await call(watcher, "crew_poll");
  await call(reviewer, "crew_poll");

  editState(crewDir, (state) => {
    state.jobs[expired].expires_at = hoursAgo(3);
    state.jobs[recent].expires_at = hoursAgo(3);
    state.jobs[legacy].state = "expired";
    state.jobs[legacy].created_at = hoursAgo(30);
    state.sessions[deadId].last_seen = hoursAgo(2);
    for (const m of state.messages) m.at = hoursAgo(2);
  });
  await call(watcher, "crew_poll");
  editState(crewDir, (state) => {
    state.jobs[expired].ended_at = hoursAgo(2);
    state.jobs[done].ended_at = hoursAgo(2);
  });

  const board = (await call(watcher, "crew_poll", { board: true })).board.map((j: any) => j.id);
  check("an expired job is pruned an hour after it ended", !board.includes(expired), board);
  check("a job that ended recently stays on the board", board.includes(recent), board);
  check("a job from before ended_at counts from creation", !board.includes(legacy), board);

  editState(crewDir, (state) => {
    const ids = Object.keys(state.jobs);
    check("a done job is pruned too", !ids.includes(done), ids);
    check(
      "read messages are pruned despite a dead session's cursor",
      !state.messages.some((m: any) => m.body === "an old broadcast"),
      state.messages
    );
  });

  await Promise.all([watcher.close(), reviewer.close(), dead.close()]);
}
