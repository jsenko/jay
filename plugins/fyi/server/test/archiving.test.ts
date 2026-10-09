/** Continuous archiving and the split between scopes. */

import { existsSync } from "node:fs";
import { join } from "node:path";

import { call, check, connect, dayOffset, section, tempStore } from "./harness.js";

/**
 * Archiving has to happen as a consequence of finishing work, not
 * because someone ran a cleanup — that is the chore that never happens.
 */
export async function run(): Promise<void> {
  section("archiving and scope");

  const store = tempStore("archiving");
  const c = await connect(store);

  // --- finishing something archives it ------------------------------
  const task = await call(c, "fyi_capture", {
    type: "task", title: "Ship the release notes",
    next_action_at: dayOffset(1), archive_after_days: 0,
  });
  check("an open task is active", (await call(c, "fyi_search", { type: ["task"] })).count === 1);

  await call(c, "fyi_update", { id: task.id, status: "done" });
  const afterDone = await call(c, "fyi_search", { type: ["task"] });
  check("a finished task leaves the active set on its own", afterDone.count === 0, afterDone);

  const archived = await call(c, "fyi_get", { id: task.id });
  check("archiving sets archived", archived.archived === true, archived);
  check("archiving records when", typeof archived.archived_at === "string", archived);
  check("nothing is deleted", archived.title === "Ship the release notes", archived);

  check("the file moves to the archive directory",
    existsSync(join(store, "default", "archive", "task", `${task.id}.md`)), store);
  check("and leaves the active directory",
    !existsSync(join(store, "default", "task", `${task.id}.md`)), store);

  check("archived items return when asked for",
    (await call(c, "fyi_search", { type: ["task"], include_archived: true })).count === 1);

  // --- lingering ----------------------------------------------------
  const lingering = await call(c, "fyi_capture", {
    type: "task", title: "Recently finished", next_action_at: dayOffset(1),
  });
  await call(c, "fyi_update", { id: lingering.id, status: "done" });
  check("a just-finished task lingers for its retention window",
    (await call(c, "fyi_search", { type: ["task"] })).count === 1);

  const pinned = await call(c, "fyi_capture", {
    type: "task", title: "Recurring check", next_action_at: dayOffset(1),
    archive_after_days: 0, pinned: true,
  });
  await call(c, "fyi_update", { id: pinned.id, status: "done" });
  check("a pinned item is never archived automatically",
    (await call(c, "fyi_search", { type: ["task"] })).items.some((i: any) => i.id === pinned.id));

  // --- per-type policy ----------------------------------------------
  const pr = await call(c, "fyi_capture", {
    type: "pr", title: "fix: retry", url: "https://github.com/acme/widgets/pull/8676", lifecycle: "merged", archive_after_days: 0,
  });
  check("a merged PR is archived", (await call(c, "fyi_search", { type: ["pr"] })).count === 0);
  check("but is still on record", (await call(c, "fyi_get", { id: pr.id })).archived === true);

  const note = await call(c, "fyi_capture", {
    type: "note", title: "Reference material", content: "Still useful years later.",
  });

  const project = await call(c, "fyi_capture", { type: "project", title: "Finished work", description: "x" });
  const decision = await call(c, "fyi_capture", {
    type: "note", title: "Chose the simple option", content: "Because.", project: project.id, tags: ["decision"],
  });
  await call(c, "fyi_update", { id: project.id, status: "done", archive_after_days: 0 });
  check("a finished project is archived", (await call(c, "fyi_search", { type: ["project"] })).count === 0, project);

  const notes = await call(c, "fyi_search", { type: ["note"] });
  check("a project's notes are archived with it", !notes.items.some((i: any) => i.id === decision.id), notes);
  check("a note without a project stays", notes.items.some((i: any) => i.id === note.id), notes);

  const handoff = await call(c, "fyi_handoff", { project: project.id });
  check("a handoff of an archived project still has its decisions",
    handoff.recent_decisions?.some((d: any) => d.id === decision.id), handoff.recent_decisions);

  // --- archiving by hand behaves the same ---------------------------
  const manual = await call(c, "fyi_capture", { type: "note", title: "Archive me", content: "x" });
  await call(c, "fyi_update", { id: manual.id, archived: true });
  check("archiving by hand moves the file too",
    existsSync(join(store, "default", "archive", "note", `${manual.id}.md`)), store);

  // --- scope --------------------------------------------------------
  const personal = await call(c, "fyi_capture", {
    type: "task", title: "Buy the replacement drive",
    next_action_at: dayOffset(2), scope: "personal",
  });
  check("a personal item lands in its own store",
    existsSync(join(store, "personal", "task", `${personal.id}.md`)), store);

  const defaultOnly = await call(c, "fyi_search", { type: ["task"] });
  check("search defaults to the default scope", !defaultOnly.items.some((i: any) => i.id === personal.id), defaultOnly.items);

  const personalOnly = await call(c, "fyi_search", { type: ["task"], scope: "personal" });
  check("personal is reachable when asked for", personalOnly.items.some((i: any) => i.id === personal.id), personalOnly);

  const both = await call(c, "fyi_search", { type: ["task"], scope: "all" });
  check("all spans both stores", both.count > personalOnly.count, { both: both.count, personal: personalOnly.count });
  check("results say which store they came from",
    both.items.find((i: any) => i.id === personal.id)?.scope === "personal", both.items);

  const todayDefault = await call(c, "fyi_today");
  check("today defaults to the default scope", todayDefault.scope === "default" && !todayDefault.upcoming.some((i: any) => i.id === personal.id), todayDefault);

  const todayAll = await call(c, "fyi_today", { scope: "all" });
  check("today can span both", todayAll.upcoming.some((i: any) => i.id === personal.id), todayAll.upcoming);

  await c.close();
}
