// Timers with a fake send and real, very short delays: what fires, when,
// and what waits for its session to go idle.

import assert from "node:assert/strict";
import { test } from "node:test";

import { rootSession } from "../timer/root.mjs";
import { Timers } from "../timer/timers.mjs";

/** Minutes for a timer that fires almost at once. */
const SOON = 0.0005;

/** Resolves after `ms` milliseconds, long enough for SOON timers to fire. */
const wait = (ms = 80) => new Promise((resolve) => setTimeout(resolve, ms));

/** Timers whose deliveries are recorded as `session: text`, or fail for a session in `failing`. */
function recorded(failing = new Set()) {
  const sent = [];
  const timers = new Timers(async (session, text) => {
    if (failing.has(session)) throw new Error("no such session");
    sent.push(`${session}: ${text}`);
  });
  return { timers, sent };
}

test("a timer sends its prompt once, marked as a timer's, and is gone after", async () => {
  const { timers, sent } = recorded();
  timers.set("s1", { name: "poll", minutes: SOON, prompt: "check crew" });
  assert.equal(timers.list("s1").length, 1);
  await wait();
  assert.deepEqual(sent, ["s1: [timer poll] check crew"]);
  assert.deepEqual(timers.list("s1"), []);
});

test("setting a name again replaces it", async () => {
  const { timers, sent } = recorded();
  assert.equal(timers.set("s1", { name: "poll", minutes: SOON, prompt: "first" }), false);
  assert.equal(timers.set("s1", { name: "poll", minutes: SOON, prompt: "second" }), true);
  await wait();
  assert.deepEqual(sent, ["s1: [timer poll] second"]);
});

test("a repeating timer fires until cancelled", async () => {
  const { timers, sent } = recorded();
  timers.set("s1", { name: "tick", minutes: SOON, prompt: "tick", repeat: true });
  await wait();
  timers.status("s1", false);
  await wait();
  timers.status("s1", false);
  await wait();
  assert.ok(sent.length >= 2, sent.join("\n"));
  assert.equal(timers.cancel("s1", "tick"), true);
  const count = sent.length;
  timers.status("s1", false);
  await wait();
  assert.equal(sent.length, count);
});

test("a prompt due mid-turn waits for idle, and one arrives per idle", async () => {
  const { timers, sent } = recorded();
  timers.status("s1", true);
  timers.set("s1", { name: "a", minutes: SOON, prompt: "first" });
  timers.set("s1", { name: "b", minutes: SOON, prompt: "second" });
  await wait();
  assert.deepEqual(sent, []);
  assert.equal(timers.list("s1").every((t) => t.waiting_for_idle), true);

  timers.status("s1", false);
  assert.equal(sent.length, 1);
  timers.status("s1", true);
  timers.status("s1", false);
  assert.equal(sent.length, 2);
  assert.deepEqual(timers.list("s1"), []);
});

test("a second timer due before the first prompt's turn starts waits for it", async () => {
  const { timers, sent } = recorded();
  timers.set("s1", { name: "a", minutes: SOON, prompt: "first" });
  timers.set("s1", { name: "b", minutes: SOON * 2, prompt: "second" });
  await wait();
  assert.equal(sent.length, 1);
  timers.status("s1", false);
  assert.equal(sent.length, 2);
});

test("cancelling drops a prompt waiting for idle", async () => {
  const { timers, sent } = recorded();
  timers.status("s1", true);
  timers.set("s1", { name: "poll", minutes: SOON, prompt: "check" });
  await wait();
  assert.equal(timers.cancel("s1", "poll"), true);
  timers.status("s1", false);
  assert.deepEqual(sent, []);
  assert.equal(timers.cancel("s1", "poll"), false);
});

test("sessions keep their own timers, and a deleted one's are dropped", async () => {
  const { timers, sent } = recorded();
  timers.set("s1", { name: "poll", minutes: SOON, prompt: "one" });
  timers.set("s2", { name: "poll", minutes: SOON, prompt: "two" });
  assert.deepEqual(timers.list("s2").map((t) => t.prompt), ["two"]);
  timers.forget("s1");
  await wait();
  assert.deepEqual(sent, ["s2: [timer poll] two"]);
});

test("a send that fails leaves the session free for the next timer", async () => {
  const failing = new Set(["s1"]);
  const { timers, sent } = recorded(failing);
  timers.set("s1", { name: "a", minutes: SOON, prompt: "lost" });
  await wait();
  failing.clear();
  timers.set("s1", { name: "b", minutes: SOON, prompt: "arrives" });
  await wait();
  assert.deepEqual(sent, ["s1: [timer b] arrives"]);
});

test("a subagent's timers belong to the top-level session above it", async () => {
  const parents = { sub2: "sub1", sub1: "main" };
  const parentOf = async (id) => parents[id];
  assert.equal(await rootSession("sub2", parentOf), "main");
  assert.equal(await rootSession("main", parentOf), "main");
  const failing = async () => {
    throw new Error("unreachable");
  };
  assert.equal(await rootSession("sub1", failing), "sub1", "a failed lookup keeps the session it has");
  const loop = async (id) => (id === "a" ? "b" : "a");
  assert.ok(["a", "b"].includes(await rootSession("a", loop)), "a loop ends");
});
