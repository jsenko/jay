/** Messaging: send, poll, cursors and wake signals. */

import { call, check, connect, section, settle, tempCrewDir, tempWorkDir, REPO_DIR } from "./harness.js";

/** Exercises delivery, idempotency, recipient validation and push signals. */
export async function run(): Promise<void> {
  section("messaging");

  const crewDir = tempCrewDir("messaging");
  const a = await connect(REPO_DIR, crewDir);
  const b = await connect(tempWorkDir(), crewDir);
  const c = await connect(tempWorkDir(), crewDir);

  // Collect wake signals pushed to B.
  const signals: unknown[] = [];
  b.fallbackNotificationHandler = async (n: any) => {
    if (n.method === "notifications/claude/channel") signals.push(JSON.parse(n.params.content));
  };

  const idA = (await call(a, "crew_join", { purpose: "Watching GitHub events", capabilities: ["watch"] })).session_id;
  const idB = (await call(b, "crew_join", { purpose: "Reviewing PRs", capabilities: ["review"] })).session_id;
  const idC = (await call(c, "crew_join", { purpose: "Coding auth", capabilities: ["code"] })).session_id;

  check("idle poll returns nothing", Object.keys(await call(b, "crew_poll")).length === 0);

  const sent = await call(a, "crew_send", { to: idB, body: "PR 8676 needs a look" });
  check("send returns a sequence number", typeof sent.seq === "number", sent);
  check("send to a live session has no warning", sent.warning === undefined, sent);

  // The wake signal has to be observed before the recipient polls: once
  // the cursor advances there is nothing left to signal about.
  await settle(600);
  check("recipient was woken", signals.length >= 1, signals);
  check("wake signal carries no message content", JSON.stringify(signals[0]) === JSON.stringify({ crew: "wake" }), signals[0]);

  const polled = await call(b, "crew_poll");
  check("recipient receives the message", polled.messages?.[0]?.body === "PR 8676 needs a look", polled);
  check("message names its sender", polled.messages?.[0]?.from === idA, polled.messages?.[0]);

  check("cursor prevents redelivery", Object.keys(await call(b, "crew_poll")).length === 0);
  check("message not delivered to unrelated session", Object.keys(await call(c, "crew_poll")).length === 0);

  await call(a, "crew_send", { to: "all", body: "switching to release branch" });
  const broadcastB = await call(b, "crew_poll");
  const broadcastC = await call(c, "crew_poll");
  check("broadcast reaches one recipient", broadcastB.messages?.[0]?.body === "switching to release branch", broadcastB);
  check("broadcast reaches the other", broadcastC.messages?.[0]?.body === "switching to release branch", broadcastC);
  check("sender does not receive its own broadcast", Object.keys(await call(a, "crew_poll")).length === 0);

  const unknown = await call(a, "crew_send", { to: "nobody-here", body: "hello" });
  check("unknown recipient is rejected", unknown.error?.includes("unknown session"), unknown);
  check("rejection lists known sessions", unknown.error?.includes(idB), unknown.error);

  await call(c, "crew_leave");
  const toDeparted = await call(a, "crew_send", { to: idC, body: "still there?" });
  check("send to a departed session still succeeds", typeof toDeparted.seq === "number", toDeparted);
  check("send to a departed session warns", toDeparted.warning?.includes("left"), toDeparted);

  // A session joining now starts at the current sequence, so it must not
  // inherit the backlog of conversations it was never part of.
  const d = await connect(tempWorkDir(), crewDir);
  await call(d, "crew_join", { purpose: "Docs work", capabilities: ["docs"] });
  check("new session gets no backlog", Object.keys(await call(d, "crew_poll")).length === 0);

  const notJoined = await connect(tempWorkDir(), crewDir);
  const orphan = await call(notJoined, "crew_poll");
  check("poll before join is rejected", orphan.error?.includes("not joined"), orphan);

  await a.close();
  await b.close();
  await c.close();
  await d.close();
  await notJoined.close();
}
