/** Notifications from outside the watched repositories: each delivered once, across polls and restarts. */

import { join } from "node:path";

import { startFake, type RawNotification } from "./fake-github.js";
import { call, check, connect, firstRound, section, settle, tempDir, until } from "./harness.js";

/** A time `secondsAhead` from now, to the second as GitHub's are. */
function stamp(secondsAhead: number): string {
  return new Date(Date.now() + secondsAhead * 1000).toISOString().replace(/\.\d+Z$/, "Z");
}

/** A mention on issue `issue` of other/sandbox, updated at `updatedAt`. */
function mention(id: string, issue: number, updatedAt: string, apiUrl: string, commentId: number): RawNotification {
  return {
    id,
    reason: "mention",
    updated_at: updatedAt,
    repository: { full_name: "other/sandbox" },
    subject: {
      type: "Issue",
      title: "`main` is broken",
      url: `${apiUrl}/repos/other/sandbox/issues/${issue}`,
      latest_comment_url: `${apiUrl}/repos/other/sandbox/issues/comments/${commentId}`,
    },
  };
}

/**
 * GitHub's `since` includes notifications updated at that instant, so the
 * newest one comes back on every poll until something newer arrives.
 */
export async function run(): Promise<void> {
  section("notifications");

  const github = await startFake("tester");
  const state = join(tempDir("notifications"), "state.json");
  const bot = { login: "github-actions[bot]", body: "`main` is broken" };

  const first = await connect(github.url, state);
  await call(first.client, "get_status");
  await firstRound(first.client);
  await settle(1500);

  const broken = mention("1", 1, stamp(5), github.url, 101);
  github.notify(broken, bot);
  await until(() => first.pushes.length > 0);
  await settle(3000);
  const ids = () => first.pushes.map((p) => p.event_id);
  check("a notification is pushed once, though later polls return it again", ids().join() === "notif-1", ids());

  const later = stamp(6);
  const reminder = mention("1", 1, later, github.url, 102);
  github.notify(reminder, { login: "github-actions[bot]", body: "broken for 4m" });
  await until(() => first.pushes.length > 1);
  const second = mention("2", 2, later, github.url, 201);
  github.notify(second, bot);
  await until(() => first.pushes.length > 2);
  await settle(3000);
  check("a new comment on the same thread is pushed again", first.pushes[1]?.event.body === "broken for 4m", first.pushes[1]);
  check("one updated in the same second as the last delivered is still pushed, once",
    ids().join() === "notif-1,notif-1,notif-2", ids());

  await first.client.close();

  const restarted = await connect(github.url, state);
  await call(restarted.client, "get_status");
  await firstRound(restarted.client);
  await settle(3000);
  check("nothing is pushed again after a restart", restarted.pushes.length === 0, restarted.pushes.map((p) => p.event_id));

  await restarted.client.close();
  await github.close();
}
