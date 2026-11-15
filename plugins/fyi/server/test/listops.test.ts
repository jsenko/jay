/** Changing one entry of a list field without rewriting the list. */

import { call, check, connect, section, tempStore } from "./harness.js";

/** Exercises add and remove on fyi_update, and their refusals. */
export async function run(): Promise<void> {
  section("list operations");

  const c = await connect(tempStore("listops"));
  const pr = await call(c, "fyi_capture", {
    type: "pr", title: "fix: retry", url: "https://github.com/acme/widgets/pull/5",
    attention_items: [{ type: "review", description: "New" }, { type: "respond", description: "Question from Eric" }],
    tags: ["a", "stale"],
  });
  const items = async () => (await call(c, "fyi_get", { id: pr.id })).attention_items as { type: string }[];

  await call(c, "fyi_update", { id: pr.id, add: { attention_items: [{ type: "decide", description: "Which cache?" }] } });
  check("add appends and keeps the rest", (await items()).map((i) => i.type).join() === "review,respond,decide", await items());

  await call(c, "fyi_update", { id: pr.id, add: { attention_items: [{ description: "Which cache?", type: "decide" }] } });
  check("an exact duplicate is skipped, whatever its key order", (await items()).length === 3, await items());

  await call(c, "fyi_update", { id: pr.id, remove: { attention_items: { type: "review" } } });
  check("remove drops matching entries only", (await items()).map((i) => i.type).join() === "respond,decide", await items());

  await call(c, "fyi_update", {
    id: pr.id,
    remove: { attention_items: { type: "decide" } },
    add: { attention_items: [{ type: "decide", description: "Settled: Varnish" }] },
  });
  const replaced = await items();
  check("remove then add replaces an entry in one call", replaced.length === 2 && JSON.stringify(replaced).includes("Settled"), replaced);

  await call(c, "fyi_update", { id: pr.id, remove: { tags: "stale" } });
  check("a value pattern removes equal entries", JSON.stringify((await call(c, "fyi_get", { id: pr.id })).tags) === '["a"]');

  const both = await call(c, "fyi_update", { id: pr.id, tags: ["x"], add: { tags: ["y"] } });
  check("setting and changing one field together is refused", both.error?.includes("both set and changed"), both);

  const notList = await call(c, "fyi_update", { id: pr.id, add: { lifecycle: ["merged"] } });
  check("add on a non-list field is refused", notList.error?.includes("not a list field"), notList);

  const invalid = await call(c, "fyi_update", { id: pr.id, add: { attention_items: [{ type: "panic", description: "x" }] } });
  check("added entries are validated", invalid.error?.includes("must be one of"), invalid);

  const badLink = await call(c, "fyi_update", { id: pr.id, add: { links: [{ id: "task-nope", rel: "relates-to" }] } });
  check("added links must resolve", badLink.error?.includes("no item with id"), badLink);

  const first = { commit: "abc1234", at: "2026-11-10T09:00:00Z", findings: "1/1", posted: false, outcomes: ["R1 open", "O1 open"] };
  const second = { commit: "def5678", at: "2026-11-12T09:00:00Z", findings: "0/0", posted: false, outcomes: ["R1 fixed in def5678", "O1 declined: the author keeps the name"] };
  await call(c, "fyi_update", { id: pr.id, add: { rounds: [first] } });
  await call(c, "fyi_update", { id: pr.id, add: { rounds: [second] } });
  const rounds = (await call(c, "fyi_get", { id: pr.id })).rounds;
  check("review rounds accumulate, outcomes and all", JSON.stringify(rounds) === JSON.stringify([first, second]), rounds);

  const noCommit = await call(c, "fyi_update", { id: pr.id, add: { rounds: [{ at: "2026-11-12T09:00:00Z" }] } });
  check("a round names the commit it reviewed", noCommit.error?.includes("commit is required"), noCommit);

  await c.close();
}
