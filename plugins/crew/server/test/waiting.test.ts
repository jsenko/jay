/** Waiting: a job no session can take waits for one instead of expiring. */

import { call, check, connect, editState, hoursAgo, section, settle, tempCrewDir, tempWorkDir } from "./harness.js";

/**
 * Expiry counts only time a session could have claimed the job, up to a
 * ceiling, so a reviewer held in focus finds its queue intact afterwards.
 */
export async function run(): Promise<void> {
  section("waiting");

  const crewDir = tempCrewDir("waiting");
  const watcher = await connect(tempWorkDir(), crewDir);
  const reviewer = await connect(tempWorkDir(), crewDir);

  await call(watcher, "crew_join", { purpose: "Watching GitHub events", capabilities: ["watch"] });
  await call(reviewer, "crew_join", { purpose: "Reviewing PRs", capabilities: ["review"] });
  await call(reviewer, "crew_state", { status: "focus" });

  const waiting = await call(watcher, "crew_post", { body: "Review PR 8676", needs: ["review"], expires_in: 0.005 });
  check("a job nobody can take is reported unroutable", waiting.routable === false, waiting);
  const ancient = (await call(watcher, "crew_post", { body: "Review PR 1", needs: ["review"] })).job_id;
  editState(crewDir, (state) => (state.jobs[ancient].created_at = hoursAgo(73)));
  await settle(600);

  const board = (await call(watcher, "crew_poll", { board: true })).board;
  const stateOf = (id: string) => board.find((j: any) => j.id === id)?.state;
  check("it waits past its expiry while nobody can take it", stateOf(waiting.job_id) === "open", board);
  check("it still expires after waiting three days", stateOf(ancient) === "expired", board);

  const late = await connect(tempWorkDir(), crewDir);
  const warned = await call(late, "crew_join", { purpose: "Starting late", capabilities: ["code"] });
  check("a joining session is warned about stranded work", warned.warnings?.[0]?.includes("needing review"), warned);

  await call(reviewer, "crew_state", { status: "idle" });
  const quiet = await call(late, "crew_join", { purpose: "Starting later", capabilities: ["code"], force_new: true });
  check("and not once a session can take it", quiet.warnings === undefined, quiet);

  // As if the last sweep while it waited were long past.
  editState(crewDir, (state) => (state.jobs[waiting.job_id].expires_at = hoursAgo(1)));
  const claimed = await call(reviewer, "crew_claim");
  check("the reviewer claims it once out of focus, its expiry started afresh", claimed.claimed?.id === waiting.job_id, claimed);

  const unclaimed = (await call(watcher, "crew_post", { body: "Review PR 2", needs: ["review"], expires_in: 0.005 })).job_id;
  await call(reviewer, "crew_state", { status: "busy" });
  await settle(600);
  const later = (await call(watcher, "crew_poll", { board: true })).board;
  check(
    "a job a session could take still expires unclaimed",
    later.find((j: any) => j.id === unclaimed)?.state === "expired",
    later
  );

  await Promise.all([watcher.close(), reviewer.close(), late.close()]);
}
