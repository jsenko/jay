/** Job queue: posting, claiming, leases and escalation. */

import { call, check, connect, section, tempCrewDir, tempWorkDir, REPO_DIR } from "./harness.js";

/** Exercises routing, the claim race, reservations and the poison guard. */
export async function run(): Promise<void> {
  section("queue");

  const crewDir = tempCrewDir("queue");
  const watcher = await connect(REPO_DIR, crewDir);
  const reviewer = await connect(tempWorkDir(), crewDir);
  const coder = await connect(tempWorkDir(), crewDir);

  const watcherId = (await call(watcher, "crew_join", { purpose: "Watching GitHub events", capabilities: ["watch"] })).session_id;
  const reviewerId = (await call(reviewer, "crew_join", { purpose: "Reviewing PRs", capabilities: ["review"] })).session_id;
  const coderId = (await call(coder, "crew_join", { purpose: "Coding auth", capabilities: ["code"] })).session_id;

  // --- routing ------------------------------------------------------
  const posted = await call(watcher, "crew_post", { body: "Review PR 8676", needs: ["review"] });
  check("post returns a job id", typeof posted.job_id === "string", posted);
  check("post reports routability", posted.routable === true, posted);
  check("only the capable session is eligible", JSON.stringify(posted.eligible_sessions) === JSON.stringify([reviewerId]), posted.eligible_sessions);

  const unroutable = await call(watcher, "crew_post", { body: "Cut a release", needs: ["release"] });
  check("unmatched job reports routable false", unroutable.routable === false, unroutable);
  check("unmatched job lists nobody", unroutable.eligible_sessions.length === 0, unroutable);

  // --- claiming -----------------------------------------------------
  check("wrong capability sees nothing", (await call(coder, "crew_claim")).claimed === null);

  const claimed = await call(reviewer, "crew_claim");
  check("matching session claims the job", claimed.claimed?.id === posted.job_id, claimed);
  check("claim returns the work itself", claimed.claimed?.body === "Review PR 8676", claimed);
  check("claim grants a lease", typeof claimed.claimed?.lease_expires_at === "string", claimed);

  const second = await call(reviewer, "crew_claim", { job_id: posted.job_id });
  check("a claimed job cannot be claimed again", second.claimed === null && second.reason === "taken", second);

  const mine = await call(reviewer, "crew_poll");
  check("holder sees its own job", mine.jobs_mine?.[0]?.id === posted.job_id, mine);

  // --- leases -------------------------------------------------------
  const extended = await call(reviewer, "crew_extend", { job_id: posted.job_id, minutes: 90 });
  check("lease extends", typeof extended.lease_expires_at === "string", extended);
  const notHolder = await call(coder, "crew_extend", { job_id: posted.job_id, minutes: 10 });
  check("only the holder may extend", notHolder.error?.includes("not held"), notHolder);

  // --- resolution ---------------------------------------------------
  const wrongHolder = await call(coder, "crew_resolve", { job_id: posted.job_id, outcome: "done" });
  check("resolving work you do not hold is rejected", wrongHolder.error?.includes(reviewerId), wrongHolder);

  const done = await call(reviewer, "crew_resolve", { job_id: posted.job_id, outcome: "done", detail: "2 must-fix" });
  check("holder resolves the job", done.ok === true && done.state === "done", done);

  const posterMail = await call(watcher, "crew_poll");
  check("poster is told the outcome", posterMail.messages?.some((m: any) => m.body.includes("done") && m.body.includes("2 must-fix")), posterMail.messages);
  check("outcome message comes from the server", posterMail.messages?.some((m: any) => m.from === "crew"), posterMail.messages);

  // --- fallback tier ------------------------------------------------
  const fb = await connect(tempWorkDir(), crewDir);
  const fbId = (await call(fb, "crew_join", { purpose: "Triage anything", capabilities: ["triage"], fallback: true })).session_id;

  const orphan = await call(watcher, "crew_post", { body: "Write release notes", needs: ["docs"] });
  check("fallback session picks up unmatched work", orphan.eligible_sessions.includes(fbId), orphan);

  const matched = await call(watcher, "crew_post", { body: "Review PR 9000", needs: ["review"] });
  check("fallback is not offered work that matches properly", !matched.eligible_sessions.includes(fbId), matched.eligible_sessions);

  // --- reservation --------------------------------------------------
  const reviewer2 = await connect(tempWorkDir(), crewDir);
  const reviewer2Id = (await call(reviewer2, "crew_join", { purpose: "Reviewing releases", capabilities: ["review"] })).session_id;

  const reserved = await call(watcher, "crew_post", { body: "Re-review PR 8676", needs: ["review"], prefer: reviewerId });
  check("reservation excludes other capable sessions", JSON.stringify(reserved.eligible_sessions) === JSON.stringify([reviewerId]), reserved.eligible_sessions);
  check("reserved job is not claimable by others", (await call(reviewer2, "crew_claim", { job_id: reserved.job_id })).claimed === null);
  check("preferred session may claim it", (await call(reviewer, "crew_claim", { job_id: reserved.job_id })).claimed?.id === reserved.job_id);

  // --- poison guard -------------------------------------------------
  const poison = await call(watcher, "crew_post", { body: "Impossible job", needs: ["review"] });
  let state = "";
  for (let i = 0; i < 3; i++) {
    await call(reviewer, "crew_claim", { job_id: poison.job_id });
    state = (await call(reviewer, "crew_resolve", { job_id: poison.job_id, outcome: "released" })).state;
  }
  check("repeated release marks the job stuck", state === "stuck", state);
  check("stuck job is not offered again", (await call(reviewer2, "crew_claim", { job_id: poison.job_id })).claimed === null);

  const stuckMail = await call(watcher, "crew_poll");
  check("poster is told the job is stuck", stuckMail.messages?.some((m: any) => m.body.includes("stuck")), stuckMail.messages);
  check("stuck job needs poster attention", stuckMail.jobs_needing_attention?.some((j: any) => j.id === poison.job_id), stuckMail.jobs_needing_attention);

  // --- board --------------------------------------------------------
  const board = await call(coder, "crew_poll", { board: true });
  check("board shows work this session cannot claim", board.board?.some((j: any) => j.id === orphan.job_id), board.board?.map((j: any) => j.id));
  check("board lists sessions", board.sessions?.length >= 4, board.sessions);

  // --- focus --------------------------------------------------------
  await call(coder, "crew_state", { status: "focus" });
  const forCoder = await call(watcher, "crew_post", { body: "Fix the build", needs: ["code"] });
  check("focused session is not routed work", !forCoder.eligible_sessions.includes(coderId), forCoder);
  // Focus takes the only capable session out of play, so the work falls
  // through to the fallback tier rather than being stranded.
  check("work orphaned by focus falls through to fallback", forCoder.eligible_sessions.includes(fbId), forCoder);

  await call(fb, "crew_leave");
  const stranded = await call(watcher, "crew_post", { body: "Fix the build again", needs: ["code"] });
  check("with no fallback left, the job is unroutable", stranded.routable === false, stranded);

  check("watcher id is stable", typeof watcherId === "string");

  await watcher.close();
  await reviewer.close();
  await reviewer2.close();
  await coder.close();
  await fb.close();
}
