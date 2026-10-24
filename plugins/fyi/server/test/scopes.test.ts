/** Scopes: the user's own, created by a tool, and searched one, several or all at once. */

import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { call, check, connect, section, tempStore } from "./harness.js";

/**
 * A scope is a directory, so creating one is all it takes; a typo is
 * refused rather than becoming a new scope.
 */
export async function run(): Promise<void> {
  section("scopes");

  const store = tempStore("scopes");
  mkdirSync(join(store, ".git"));
  mkdirSync(join(store, "attachments"));
  const c = await connect(store);

  const created = await call(c, "fyi_create_scope", { name: "side-project" });
  check("a created scope is listed with the built-in ones, and nothing else is",
    JSON.stringify(created.scopes) === '["default","personal","side-project","work"]', created);
  check("a scope name must be lowercase", (await call(c, "fyi_create_scope", { name: "Side Project" })).error?.includes("can't be a scope"));
  check("and not search's word for every scope", (await call(c, "fyi_create_scope", { name: "all" })).error?.includes("can't be a scope"));

  const side = await call(c, "fyi_capture", { type: "note", title: "Side idea", content: "x", scope: "side-project" });
  check("an item captured into it lands in its directory", existsSync(join(store, "side-project", "note", `${side.id}.md`)), side);
  await call(c, "fyi_capture", { type: "note", title: "Work idea", content: "x", scope: "work" });
  await call(c, "fyi_capture", { type: "note", title: "Default idea", content: "x" });

  const titles = async (scope: unknown) =>
    (await call(c, "fyi_search", { type: ["note"], ...(scope === undefined ? {} : { scope }) })).items?.map((i: any) => i.title).sort();
  check("one scope searches only it", JSON.stringify(await titles("side-project")) === '["Side idea"]');
  check("a list searches those", JSON.stringify(await titles(["side-project", "work"])) === '["Side idea","Work idea"]');
  check("all searches every scope", (await titles("all"))?.length === 3);
  check("nothing named means the default", JSON.stringify(await titles(undefined)) === '["Default idea"]');
  check("an unknown scope in a list is refused", (await call(c, "fyi_search", { scope: ["work", "wrok"] })).error?.includes('no scope "wrok"'));
  // --- moving between scopes ----------------------------------------
  const project = await call(c, "fyi_capture", { type: "project", title: "Garden shed", description: "A shed for the garden tools", status: "active", scope: "work" });
  writeFileSync(join(project.folder, "PLAN.md"), "the plan");
  const decision = await call(c, "fyi_capture", { type: "note", title: "Cedar, not pine", content: "x", project: project.id, tags: ["decision"], scope: "work" });
  const elsewhere = await call(c, "fyi_capture", { type: "note", title: "Ask the neighbour", content: "x", project: project.id });

  const moved = await call(c, "fyi_update", { id: project.id, scope: "personal" });
  check("a project moves to another scope, keeping its id", moved.updated?.includes("scope") && existsSync(join(store, "personal", "project", `${project.id}.md`)) && !existsSync(join(store, "work", "project", `${project.id}.md`)), moved);
  check("its folder moves with it", moved.folder === join(store, "personal", "projects", "garden-shed") && readFileSync(join(moved.folder, "PLAN.md"), "utf8") === "the plan", moved);
  check("and the old path still reaches it, for checkouts linked there", readFileSync(join(project.folder, "PLAN.md"), "utf8") === "the plan" && lstatSync(project.folder).isSymbolicLink());
  check("its notes in the scope it left come with it, others stay",
    JSON.stringify(moved.also_moved) === JSON.stringify([decision.id]) && existsSync(join(store, "default", "note", `${elsewhere.id}.md`)), moved);
  const handoff = await call(c, "fyi_handoff", { project: project.id });
  const noted = handoff.recent_decisions?.map((n: any) => n.id).sort();
  check("the handoff finds its folder, and its notes in every scope", handoff.project?.folder === moved.folder && JSON.stringify(noted) === JSON.stringify([decision.id, elsewhere.id].sort()), handoff);

  const back = await call(c, "fyi_update", { id: project.id, scope: "work" });
  check("and it can move back", back.folder === project.folder && !lstatSync(project.folder).isSymbolicLink() && readFileSync(join(project.folder, "PLAN.md"), "utf8") === "the plan", back);
  check("moving to a scope that doesn't exist is refused", (await call(c, "fyi_update", { id: project.id, scope: "wrok" })).error?.includes('no scope "wrok"'));
  await c.close();

  const custom = await connect(store, { defaultScope: "side-project" });
  const today = await call(custom, "fyi_today");
  check("a scope of the user's own can be the default", today.scope === "side-project", today);
  await custom.close();
}
