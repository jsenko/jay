/** When items finished, archiving counted from it, notes that expire, and the backfill. */

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { call, check, connect, dayOffset, section, tempStore } from "./harness.js";

const MIGRATION = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations", "completed-at.ts");

/** An ISO timestamp `days` from now, negative for the past. */
function isoOffset(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

/**
 * A report of "what was finished this week" is only right if finishing is
 * recorded once, and later edits don't move it.
 */
export async function run(): Promise<void> {
  section("completion");

  const store = tempStore("completion");
  const c = await connect(store);

  // --- stamped on finishing, kept through edits, cleared on reopening ---
  const task = await call(c, "fyi_capture", { type: "task", title: "Write the notes", next_action_at: dayOffset(1) });
  check("an open task has no completed_at", (await call(c, "fyi_get", { id: task.id })).completed_at === undefined);

  await call(c, "fyi_update", { id: task.id, status: "done" });
  const done = await call(c, "fyi_get", { id: task.id });
  check("finishing stamps completed_at", typeof done.completed_at === "string", done);

  await call(c, "fyi_update", { id: task.id, description: "A later edit." });
  const edited = await call(c, "fyi_get", { id: task.id });
  check("a later edit keeps it", edited.completed_at === done.completed_at && edited.updated_at > done.completed_at, edited);

  await call(c, "fyi_update", { id: task.id, status: "open" });
  check("reopening clears it", (await call(c, "fyi_get", { id: task.id })).completed_at === undefined);

  const merged = await call(c, "fyi_capture", {
    type: "pr", title: "fix: retry", url: "https://github.com/acme/widgets/pull/12", lifecycle: "merged",
  });
  check("any type with a finished state gets it, from capture too",
    typeof (await call(c, "fyi_get", { id: merged.id })).completed_at === "string");

  // --- recorded late: the supplied time counts, for search and archiving ---
  const late = await call(c, "fyi_capture", {
    type: "task", title: "Finished last month", next_action_at: dayOffset(1), status: "done",
    completed_at: isoOffset(-20),
  });
  check("archiving counts from completed_at, not the last edit",
    (await call(c, "fyi_get", { id: late.id })).archived === true);

  await call(c, "fyi_update", { id: task.id, status: "done" });
  const thisWeek = await call(c, "fyi_search", {
    type: ["task"], include_archived: true, where: { completed_at: { after: dayOffset(-7) } },
  });
  check("search finds what was finished in a period, and only that",
    thisWeek.items.map((i: any) => i.id).join() === task.id, thisWeek.items);

  // --- notes expire only when asked to ---------------------------------
  const brief = await call(c, "fyi_capture", { type: "note", title: "A brief", content: "x", archive_after_days: 0 });
  const kept = await call(c, "fyi_capture", { type: "note", title: "Kept a while", content: "x", archive_after_days: 14 });
  const notes = await call(c, "fyi_search", { type: ["note"] });
  check("a note with archive_after_days expires", !notes.items.some((i: any) => i.id === brief.id), notes.items);
  check("and not before its time", notes.items.some((i: any) => i.id === kept.id), notes.items);

  await c.close();

  // --- the backfill ----------------------------------------------------
  const old = tempStore("completion-old");
  mkdirSync(join(old, "default", "task"), { recursive: true });
  const finishedAt = isoOffset(-1);
  writeFileSync(join(old, "default", "task", "task-old-done.md"), `---
id: task-old-done
type: task
title: Old and done
status: done
next_action_at: ${dayOffset(-2)}
created_at: ${isoOffset(-3)}
updated_at: ${finishedAt}
---
`);
  writeFileSync(join(old, "default", "task", "task-old-open.md"), `---
id: task-old-open
type: task
title: Old and open
status: open
next_action_at: ${dayOffset(1)}
created_at: ${isoOffset(-3)}
updated_at: ${isoOffset(-3)}
---
`);

  const env = { ...process.env, FYI_DIR: old };
  const output = execFileSync("npx", ["tsx", MIGRATION], { env, encoding: "utf8" });
  check("the backfill stamps only finished items", output.includes("1 stamped") && !output.includes("task-old-open"), output);

  const m = await connect(old);
  const stamped = await call(m, "fyi_get", { id: "task-old-done" });
  check("with their last edit", stamped.completed_at === finishedAt, stamped);
  await m.close();

  const rerun = execFileSync("npx", ["tsx", MIGRATION], { env, encoding: "utf8" });
  check("running it again changes nothing", rerun.includes("0 stamped"), rerun);
}
