/** Focus: it holds work back only while the user is there. */

import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { call, check, connect, section, settle, tempCrewDir, tempWorkDir } from "./harness.js";

/** The prompt hook, as Claude Code runs it. */
const PROMPT_HOOK = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "activity", "prompt.mjs");

/** Runs the prompt hook for a session in `directory`, as the user writing there does. */
function userWrites(directory: string, crewDir: string): string {
  return execFileSync("node", [PROMPT_HOOK], {
    env: { ...process.env, CREW_DIR: crewDir, CLAUDE_PROJECT_DIR: directory },
    input: JSON.stringify({ prompt: "hello" }),
    encoding: "utf8",
  });
}

/**
 * A session can't tell that the user left, so focus it set stayed for
 * hours and every job behind it waited. It lapses instead, here after
 * about two seconds, and holds again when the user writes.
 */
export async function run(): Promise<void> {
  section("focus");

  const crewDir = tempCrewDir("focus");
  const env = { CREW_FOCUS_LAPSE_MIN: "0.03", CREW_RECHECK_MS: "300" };
  const reviewerDir = tempWorkDir();
  const watcher = await connect(tempWorkDir(), crewDir, env);
  const reviewer = await connect(reviewerDir, crewDir, env);
  const wakes: unknown[] = [];
  reviewer.fallbackNotificationHandler = async (n: any) => {
    if (n.method === "notifications/claude/channel" && JSON.parse(n.params.content).crew === "wake") wakes.push(n);
  };

  await call(watcher, "crew_join", { purpose: "Watching GitHub events", capabilities: ["watch"] });
  await call(reviewer, "crew_join", { purpose: "Reviewing PRs", capabilities: ["review"] });
  await call(reviewer, "crew_state", { status: "focus" });

  const held = await call(watcher, "crew_post", { body: "Review PR 1", needs: ["review"] });
  check("fresh focus holds work back", held.routable === false, held);
  const who = (await call(watcher, "crew_who")).sessions.find((s: any) => s.purpose === "Reviewing PRs");
  check("the roster says how long it has been in focus, and that it holds", who?.focus?.holds_work === true && who?.focus?.since === "just now", who);

  await settle(2200);
  check("once the user has been gone past the lapse, the session is woken", wakes.length > 0, wakes.length);
  const poll = await call(reviewer, "crew_poll");
  check("and offered the job focus held back", poll.claimable?.id === held.job_id, poll);
  check("and told that focus lapsed", typeof poll.focus_lapsed === "string" && poll.focus_lapsed.includes("no longer holds"), poll);
  const lapsed = (await call(watcher, "crew_who")).sessions.find((s: any) => s.purpose === "Reviewing PRs");
  check("the roster shows it no longer holds", lapsed?.focus?.holds_work === false, lapsed);

  check("the prompt hook prints nothing", userWrites(reviewerDir, crewDir) === "");
  const again = await call(watcher, "crew_post", { body: "Review PR 2", needs: ["review"] });
  check("when the user writes, focus holds again", again.routable === false, again);
  check("without the session setting it", (await call(reviewer, "crew_poll")).focus_lapsed === undefined);

  await Promise.all([watcher.close(), reviewer.close()]);
}
