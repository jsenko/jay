/** Pushes to open PRs, noticed from moved heads rather than the event stream. */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { comment, startFake } from "./fake-github.js";
import { call, check, connect, firstRound, section, settle, tempDir, until } from "./harness.js";

/** The synchronize events a session was pushed. */
function synchronizes(pushes: any[]): any[] {
  return pushes.filter((p) => p.event.type === "PullRequestEvent" && p.event.action === "synchronize");
}

/**
 * A push the watcher misses is a re-review never done, and one reported
 * twice is a re-review done twice.
 */
export async function run(): Promise<void> {
  section("pushes");

  const github = await startFake("tester");
  const state = join(tempDir("pushes"), "state.json");
  github.pull("acme/widgets", { number: 5, title: "Retry on startup", head: "aaa1111", user: { login: "alice" } });
  github.pull("acme/widgets", { number: 6, title: "From a fork", head: "ccc3333", user: { login: "bob" } });
  // The stream needs an event before watching starts, or it has no cursor
  // and drops the synchronize below as history rather than as a duplicate.
  github.add(comment("alice", "before the watcher started"));

  const first = await connect(github.url, state);
  await call(first.client, "get_status");
  await firstRound(first.client);
  await settle(1500);
  check("heads already there when watching starts are not reported", synchronizes(first.pushes).length === 0, first.pushes);
  check("an unchanged pull list costs a 304", github.pullsNotModified > 0, github.pullsNotModified);

  github.moveHead("acme/widgets", 5, "bbb2222");
  github.add({
    id: "9001", type: "PullRequestEvent", actor: { login: "alice" }, repo: { name: "acme/widgets" },
    payload: { action: "synchronize", pull_request: { number: 5, url: `${github.url}/repos/acme/widgets/pulls/5` } },
    created_at: new Date().toISOString(),
  });
  await until(() => synchronizes(first.pushes).length > 0);
  await settle(2500);
  const pushed = synchronizes(first.pushes);
  check("a moved head is reported as one synchronize, even when the stream carries one too", pushed.length === 1, pushed);
  const event = pushed[0]?.event;
  check("it names the PR and the heads before and after",
    event?.refs.pr.number === 5 && event.before === "aaa1111" && event.after === "bbb2222" && event.actor === "alice", event);

  github.closePull("acme/widgets", 6);
  await settle(2500);
  await first.client.close();
  const heads = JSON.parse(readFileSync(state, "utf8")).pullHeads["acme/widgets"].heads;
  check("a closed PR's head is forgotten", heads["6"] === undefined && heads["5"] === "bbb2222", heads);

  // --- a push while the server was down -----------------------------------
  github.moveHead("acme/widgets", 5, "ddd4444");
  const second = await connect(github.url, state);
  await call(second.client, "get_status");
  await until(() => synchronizes(second.pushes).length > 0);
  await settle(1500);
  const resumed = synchronizes(second.pushes);
  check("a push while the server was down is reported after a restart, once",
    resumed.length === 1 && resumed[0].event.before === "bbb2222" && resumed[0].event.after === "ddd4444", resumed);

  await second.client.close();
  await github.close();
}
