/** PR events describe the PR as it is now, not as it was first read. */

import { join } from "node:path";

import { comment, startFake } from "./fake-github.js";
import { call, check, connect, firstRound, section, settle, tempDir, until } from "./harness.js";

/** A PR event on `number` of acme/widgets, by alice. */
function prEvent(id: string, action: string, number: number, url: string): any {
  return {
    id, type: "PullRequestEvent", actor: { login: "alice" }, repo: { name: "acme/widgets" },
    payload: { action, pull_request: { number, url: `${url}/repos/acme/widgets/pulls/${number}` } },
    created_at: new Date().toISOString(),
  };
}

/**
 * The watcher acts on lifecycle labels. A label event carrying the labels
 * the PR had when it opened sends it after a state long gone.
 */
export async function run(): Promise<void> {
  section("labels");

  const github = await startFake("tester");
  const state = join(tempDir("labels"), "state.json");
  github.pull("acme/widgets", { number: 8, title: "Validate refs", user: { login: "alice" }, labels: [{ name: "lifecycle/validation-failed" }] });
  github.add(comment("alice", "before the watcher started"));

  const conn = await connect(github.url, state);
  await call(conn.client, "get_status");
  await firstRound(conn.client);

  github.add(prEvent("8001", "opened", 8, github.url));
  await until(() => conn.pushes.some((p) => p.event_id === "8001"));
  const opened = conn.pushes.find((p) => p.event_id === "8001")?.event;
  check("an opened PR carries its labels", opened?.labels.join() === "lifecycle/validation-failed", opened?.labels);

  github.relabel("acme/widgets", 8, ["lifecycle/ready-for-review"]);
  github.add(prEvent("8002", "unlabeled", 8, github.url));
  github.add(prEvent("8003", "labeled", 8, github.url));
  await until(() => conn.pushes.some((p) => p.event.action === "labels-changed"));
  await settle(1500);
  const changed = conn.pushes.filter((p) => p.event.action === "labels-changed");
  check("a run of label events is pushed once", changed.length === 1, changed.map((p) => p.event_id));
  check("with the labels the PR has now, not those it opened with",
    changed[0]?.event.labels.join() === "lifecycle/ready-for-review", changed[0]?.event.labels);
  const reads = github.requests.filter((r) => r === "/repos/acme/widgets/pulls/8").length;
  check("one read for the opening, and one for the whole run", reads === 2, reads);

  github.add(prEvent("8004", "labeled", 404, github.url));
  await until(() => conn.pushes.some((p) => p.event_id === "8004"));
  const unread = conn.pushes.find((p) => p.event_id === "8004")?.event;
  check("a PR that can't be read is marked unread, not given empty labels", unread?.unread === true, unread);

  await conn.client.close();
  await github.close();
}
