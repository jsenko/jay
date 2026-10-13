/** What reaches a session: delivery, filtering, age, and the cursor across restarts. */

import { join } from "node:path";

import { comment, startFake } from "./fake-github.js";
import { call, check, connect, firstRound, section, settle, tempDir, until } from "./harness.js";

/**
 * A watcher acts on every event it is given, so an event delivered twice
 * is work done twice, and one dropped is work never done.
 */
export async function run(): Promise<void> {
  section("events");

  const github = await startFake("tester");
  const state = join(tempDir("events"), "state.json");
  github.add(comment("alice", "before the watcher started"));

  // --- a session that never asks for events costs nothing ---------------
  const idle = await connect(github.url, join(tempDir("idle"), "state.json"));
  await call(idle.client, "github_api", { url: `${github.url}/repos/acme/widgets/issues/7` });
  await settle(2500);
  const isPolling = (path: string) => path === "/user" || path.endsWith("/events") || path.endsWith("/runs") || path === "/notifications";
  check("a server nobody asks for events makes no polling calls", !github.requests.some(isPolling), github.requests);

  const asked = await call(idle.client, "get_status");
  check("the first get_status starts polling, and knows the user and repositories when it answers",
    asked.polling === true && asked.authenticatedUser === "tester" && asked.monitoredRepos.join() === "acme/widgets", asked);
  await idle.client.close();
  github.requests.length = 0;

  const first = await connect(github.url, state);
  await settle(1500);
  check("nothing says hello before the session calls a tool", first.hellos === 0, first.hellos);
  await until(() => false, 1000);
  const nothing = await call(first.client, "get_new_events");
  await firstRound(first.client);
  check("events already there when watching starts are not delivered",
    first.pushes.length === 0 && nothing.length === 0 && (await call(first.client, "get_new_events")).length === 0, first.pushes);

  const long = comment("alice", "x".repeat(300));
  const ignored = comment("EricWittbot", "routine bot comment");
  const mention = comment("EricWittbot", "@tester please look");
  const old = comment("bob", "from two days ago", 48);
  for (const e of [long, ignored, mention, old]) github.add(e);

  await until(() => first.pushes.length >= 2);
  await settle(1500);
  const pushed = first.pushes.map((p) => p.event_id);
  check("a new event is pushed to the session", pushed.includes(long.id), pushed);
  check("an ignored actor is filtered", !pushed.includes(ignored.id), pushed);
  check("unless the user is mentioned", pushed.includes(mention.id), pushed);
  check("events older than the age limit are dropped", !pushed.includes(old.id), pushed);
  check("each is pushed once", new Set(pushed).size === pushed.length, pushed);

  const pushedLong = first.pushes.find((p) => p.event_id === long.id);
  check("a push carries a truncated body", pushedLong?.event.body.length <= 200, pushedLong?.event.body.length);
  const full = await call(first.client, "get_event", { event_id: long.id });
  check("get_event gives the whole body", full.body?.length === 300, full.body?.length);

  const polled = (await call(first.client, "get_new_events")).map((e: any) => e.event_id);
  check("get_new_events returns what arrived", polled.includes(long.id) && polled.includes(mention.id), polled);
  check("and returns it only once", (await call(first.client, "get_new_events")).length === 0);

  await settle(500);
  check("the first tool call brings one hello, and later calls none", first.hellos === 1, first.hellos);

  await first.client.close();

  // --- the cursor survives a restart -----------------------------------
  const whileDown = comment("dave", "while the server was down");
  github.add(whileDown);

  const second = await connect(github.url, state);
  await call(second.client, "get_status");
  await until(() => second.pushes.length > 0, 4000);
  await settle(1500);
  const resent = second.pushes.map((p) => p.event_id);
  check("an event from while it was down is delivered after a restart", resent.includes(whileDown.id), resent);
  check("and nothing seen before is delivered again", resent.join() === whileDown.id, resent);

  const after = comment("carol", "after the restart");
  github.add(after);
  await until(() => second.pushes.length > 1);
  check("then carries on with what is new", second.pushes.map((p) => p.event_id).join() === `${whileDown.id},${after.id}`, second.pushes);

  const status = await call(second.client, "get_status");
  check("status reports the user and repositories", status.authenticatedUser === "tester"
    && status.monitoredRepos.join() === "acme/widgets", status);

  const outside = await call(second.client, "github_api", { url: "https://example.com/x" });
  check("github_api refuses URLs outside the API", typeof outside.error === "string", outside);

  await second.client.close();
  await github.close();
}
