/** Scopes: the user's own, created by a tool, and searched one, several or all at once. */

import { existsSync, mkdirSync } from "node:fs";
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
  await c.close();

  const custom = await connect(store, { defaultScope: "side-project" });
  const today = await call(custom, "fyi_today");
  check("a scope of the user's own can be the default", today.scope === "side-project", today);
  await custom.close();
}
