/** The reconcile's lookups: PRs involving the user, and a head's check status. */

import { join } from "node:path";

import { startFake } from "./fake-github.js";
import { call, check, connect, section, tempDir } from "./harness.js";

/** A check run, `minutesAgo` minutes old. */
function checkRun(id: number, name: string, conclusion: string | null, minutesAgo: number | null) {
  return {
    id,
    name,
    status: conclusion === null ? "queued" : "completed",
    conclusion,
    started_at: minutesAgo === null ? null : new Date(Date.now() - minutesAgo * 60_000).toISOString(),
  };
}

/**
 * Both lookups replace something a watcher got wrong by hand: trusting a
 * search index that lagged, and reading superseded runs as failures.
 */
export async function run(): Promise<void> {
  section("pulls");

  const github = await startFake("tester");
  github.pull("acme/widgets", { number: 1, title: "Mine", user: { login: "tester" } });
  github.pull("acme/widgets", { number: 2, title: "Assigned", user: { login: "alice" }, assignees: [{ login: "Tester" }] });
  github.pull("acme/gadgets", { number: 3, title: "Review asked", user: { login: "bob" }, requested_reviewers: [{ login: "tester" }] });
  github.pull("acme/gadgets", { number: 4, title: "Someone else's", user: { login: "bob" }, assignees: [{ login: "carol" }] });
  github.breakRepo("acme/broken");

  const conn = await connect(github.url, join(tempDir("pulls"), "state.json"), "acme/widgets,acme/gadgets,acme/broken");
  const found = await call(conn.client, "get_involved_prs");
  const listed = found.prs?.map((p: any) => `${p.repo}#${p.number}:${p.involves.join("+")}`);
  check(
    "authored, assigned and review-requested PRs are listed, and no others",
    JSON.stringify(listed) === JSON.stringify(["acme/gadgets#3:review-requested", "acme/widgets#1:author", "acme/widgets#2:assignee"]),
    found
  );
  check("a repository that can't be read is reported, not dropped", JSON.stringify(found.failed) === '["acme/broken"]', found.failed);

  const status = async (number: number, gates: string[] = []) =>
    (await call(conn.client, "get_check_status", { url: `https://github.com/acme/widgets/pull/${number}`, gates })).check_status;

  github.pull("acme/widgets", { number: 10, title: "Re-run", head: "rerun" });
  github.checks("rerun", { runs: [checkRun(1, "Validate PR", "failure", 60), checkRun(2, "Validate PR", "success", 10), checkRun(3, "Docs", "skipped", 5)] });
  check("a failure a later run replaced is passing, skipped runs ignored", (await status(10)) === "passing");

  github.pull("acme/widgets", { number: 11, title: "Fork", head: "fork" });
  github.checks("fork", { runs: [checkRun(4, "Build", "success", 5)], held: ["Integration Tests"] });
  check("a run held for approval is needs-approval, though the rollup omits it", (await status(11)) === "needs-approval");

  github.pull("acme/widgets", { number: 12, title: "Gated", head: "gated" });
  github.checks("gated", { runs: [checkRun(5, "Build", "success", 5), checkRun(6, "Verification Gate", "failure", 5)] });
  check("a failing gate the project names is pending", (await status(12, ["Verification Gate"])) === "pending");
  check("the same gate unnamed is failing", (await status(12)) === "failing");

  github.pull("acme/widgets", { number: 13, title: "Queued", head: "queued" });
  github.checks("queued", { runs: [checkRun(7, "Build", "failure", 30), checkRun(8, "Build", null, null)], statuses: [{ context: "ci/legacy", state: "success" }] });
  check("a queued re-run supersedes the failure before it", (await status(13)) === "pending");

  github.checks("rerun", { runs: [checkRun(2, "Validate PR", "success", 10)], statuses: [{ context: "ci/legacy", state: "error" }] });
  check("a failed commit status counts too", (await status(10)) === "failing");

  await conn.client.close();
  await github.close();
}
