/** Session registry: join, leave, who, state. */

import { join } from "node:path";

import { call, check, connect, section, settle, tempCrewDir, tempWorkDir, REPO, REPO_DIR } from "./harness.js";

/** Exercises registration, identity, validation and departure. */
export async function run(): Promise<void> {
  section("registry");

  const crewDir = tempCrewDir("registry");
  const plainDir = tempWorkDir();

  const a = await connect(REPO_DIR, crewDir);
  const b = await connect(plainDir, crewDir);

  const joinA = await call(a, "crew_join", { purpose: "Reviewing PRs", capabilities: ["review"] });
  check("join returns an id", typeof joinA.session_id === "string", joinA);
  check("id derives from purpose and repo", joinA.session_id === "review-widgets", joinA.session_id);
  check("repo detected from cwd", joinA.repos.includes(REPO), joinA.repos);
  check("notification mode reported", ["channel", "poll"].includes(joinA.notifications), joinA.notifications);
  check("no others yet", joinA.others.length === 0, joinA.others);

  const joinB = await call(b, "crew_join", {
    purpose: "Watching GitHub events",
    capabilities: ["watch"],
    fallback: true,
  });
  check("second session gets its own id", joinB.session_id === "watch-github-events", joinB.session_id);
  check("non-repo directory yields no repos", joinB.repos.length === 0, joinB.repos);
  check("second session sees the first", joinB.others.some((o: any) => o.id === joinA.session_id), joinB.others);

  const rejoin = await call(a, "crew_join", { purpose: "Reviewing PRs" });
  check("rejoin resumes rather than duplicating", rejoin.resumed && rejoin.session_id === joinA.session_id, rejoin);

  const forced = await call(a, "crew_join", { purpose: "Reviewing PRs", force_new: true });
  check("force_new creates a distinct id", forced.session_id !== joinA.session_id, forced.session_id);

  const badCap = await call(a, "crew_join", { purpose: "x", capabilities: ["reviews"] });
  check("typo capability is rejected", badCap.error?.includes("unknown capability"), badCap);
  check("rejection lists the valid set", badCap.error?.includes("review, code, watch"), badCap.error);

  const badStatus = await call(b, "crew_state", { status: "sleeping" });
  check("invalid status is rejected", typeof badStatus.error === "string", badStatus);

  const busy = await call(b, "crew_state", { status: "busy", activity: "Triaging PR 8676" });
  check("state updates", busy.status === "busy" && busy.activity === "Triaging PR 8676", busy);

  const roster = await call(a, "crew_who");
  check("roster lists all live sessions", roster.sessions.length === 3, roster.sessions.map((s: any) => s.id));
  check("roster reports own id", roster.you === forced.session_id, roster.you);
  const watcher = roster.sessions.find((s: any) => s.id === joinB.session_id);
  check("roster carries status through", watcher?.status === "busy", watcher);
  check("roster carries fallback flag", watcher?.fallback === true, watcher);

  const left = await call(b, "crew_leave");
  check("leave reports the session", left.left === joinB.session_id, left);

  const after = await call(a, "crew_who");
  check("left session drops off the roster", !after.sessions.some((s: any) => s.id === joinB.session_id), after.sessions.map((s: any) => s.id));

  const c = await connect(plainDir, crewDir);
  const joinC = await call(c, "crew_join", { purpose: "Research", capabilities: ["research"] });
  check("third session joined", typeof joinC.session_id === "string", joinC);
  await c.close();
  await settle();

  const afterClose = await call(a, "crew_who");
  check(
    "disconnect marks the session offline",
    !afterClose.sessions.some((s: any) => s.id === joinC.session_id),
    afterClose.sessions.map((s: any) => s.id)
  );

  const fresh = await connect(plainDir, join(tempCrewDir("fresh"), "not-yet"));
  const joinFresh = await call(fresh, "crew_join", { purpose: "First session after install" });
  check("a fresh install creates its state directory", typeof joinFresh.session_id === "string", joinFresh);
  await fresh.close();

  await a.close();
  await b.close();
}
