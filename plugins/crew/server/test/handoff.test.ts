/** Hand-offs: work reaches a focused session, and a waiting job says why. */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";

import { call, check, connect, section, settle, tempCrewDir, tempWorkDir } from "./harness.js";

/** Counts the wakes a client receives. */
function countWakes(client: Client): { count: number } {
  const wakes = { count: 0 };
  client.fallbackNotificationHandler = async (n: any) => {
    if (n.method === "notifications/claude/channel" && JSON.parse(n.params.content).crew === "wake") wakes.count++;
  };
  return wakes;
}

/**
 * On 9 November the user had the watcher hand two jobs to a coder they
 * had just been working in; its focus held them back, nothing woke it,
 * and the watcher could only say the jobs weren't routable.
 */
export async function run(): Promise<void> {
  section("hand-offs");

  const crewDir = tempCrewDir("handoff");
  const watcher = await connect(tempWorkDir(), crewDir);
  const coder = await connect(tempWorkDir(), crewDir);
  const reviewer = await connect(tempWorkDir(), crewDir);
  const coderWakes = countWakes(coder);
  const reviewerWakes = countWakes(reviewer);

  await call(watcher, "crew_join", { purpose: "Watching GitHub events", capabilities: ["watch"] });
  const coderId = (await call(coder, "crew_join", { purpose: "Coding", capabilities: ["code"] })).session_id;
  const reviewerId = (await call(reviewer, "crew_join", { purpose: "Reviewing PRs", capabilities: ["review"] })).session_id;
  await call(coder, "crew_state", { status: "focus" });
  await call(reviewer, "crew_state", { status: "focus" });
  await settle(600);
  coderWakes.count = 0;
  reviewerWakes.count = 0;

  const direct = await call(watcher, "crew_post", { body: "Backport #11060", to: coderId, needs: ["code"] });
  check("a job handed to a focused session isn't routable", direct.routable === false, direct);
  check("and the poster is told why", direct.waiting_on?.includes(`${coderId} is in focus`), direct);
  await settle(600);
  check("the focused session is woken for it", coderWakes.count > 0, coderWakes.count);
  const coderPoll = await call(coder, "crew_poll");
  check("its poll lists it as held by focus", coderPoll.held_by_focus?.[0]?.id === direct.job_id, coderPoll);
  check("and doesn't route it", coderPoll.claimable === undefined, coderPoll);

  const pooled = await call(watcher, "crew_post", { body: "Review PR 10842", needs: ["review"] });
  check("a pooled job behind focus says which session holds it", pooled.waiting_on?.includes(`in focus with the user: ${reviewerId}`), pooled);
  await settle(600);
  check("but doesn't wake the focused session", reviewerWakes.count === 0, reviewerWakes.count);
  check("whose poll still lists it", (await call(reviewer, "crew_poll")).held_by_focus?.[0]?.id === pooled.job_id);

  const docs = await call(watcher, "crew_post", { body: "Document the new flag", needs: ["docs"] });
  check("a job nobody advertises the capabilities for says so", docs.waiting_on === "no session advertises docs", docs);
  const board = (await call(watcher, "crew_poll", { board: true })).board;
  check("the board says why each waiting job waits", board.every((j: any) => typeof j.waiting_on === "string"), board);

  const claimed = await call(coder, "crew_claim", { job_id: direct.job_id });
  check("once the user agrees, the session claims it by id", claimed.claimed?.id === direct.job_id, claimed);

  await Promise.all([watcher.close(), coder.close(), reviewer.close()]);
}
