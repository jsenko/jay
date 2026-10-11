/** Project folders: where a project's files go, owned by fyi. */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { call, check, connect, dayOffset, section, tempStore } from "./harness.js";

/**
 * Other plugins keep a project's files in its folder without knowing the
 * store's layout, so fyi has to hand out the path, and keep finding the
 * folders that existed before it did.
 */
export async function run(): Promise<void> {
  section("project folders");

  const store = tempStore("folders");
  // A folder made by hand before fyi knew about folders, with a file in it.
  const existing = join(store, "default", "projects", "older");
  mkdirSync(existing, { recursive: true });
  writeFileSync(join(existing, "PLAN.md"), "# plan\n");
  const c = await connect(store);

  const fresh = await call(c, "fyi_capture", { type: "project", title: "New work", slug: "new-work", description: "x" });
  check("capturing a project creates its folder", fresh.folder === join(store, "default", "projects", "new-work") && existsSync(fresh.folder), fresh);

  const older = await call(c, "fyi_capture", { type: "project", title: "Older work", slug: "older", description: "x" });
  check("an existing folder is found where it was, its files intact",
    older.folder === existing && readFileSync(join(existing, "PLAN.md"), "utf8") === "# plan\n", older);

  check("fyi_get gives a project its folder", (await call(c, "fyi_get", { id: older.id })).folder === existing);
  const handoff = await call(c, "fyi_handoff", { project: older.id });
  check("and so does fyi_handoff", handoff.project.folder === existing, handoff.project);

  const task = await call(c, "fyi_capture", { type: "task", title: "Not a project", next_action_at: dayOffset(1) });
  check("other types have no folder", (await call(c, "fyi_get", { id: task.id })).folder === undefined);

  await call(c, "fyi_update", { id: fresh.id, archived: true });
  check("an archived project keeps its folder", (await call(c, "fyi_get", { id: fresh.id })).folder === fresh.folder);

  await c.close();
}
