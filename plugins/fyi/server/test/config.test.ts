/** Settings from the store's config.json: the default scope. */

import { existsSync } from "node:fs";
import { join } from "node:path";

import { call, check, connect, dayOffset, section, tempStore } from "./harness.js";

/**
 * Someone whose items mostly belong elsewhere than work sets that once, and every
 * call without a scope follows it; a typo must not send items to the wrong store.
 */
export async function run(): Promise<void> {
  section("config");

  const store = tempStore("config");
  const c = await connect(store, { defaultScope: "personal" });

  const note = await call(c, "fyi_capture", { type: "note", title: "Renew the passport", content: "x" });
  check("a capture without a scope goes to the configured default",
    existsSync(join(store, "personal", "note", `${note.id}.md`)), store);

  const found = await call(c, "fyi_search", { type: ["note"] });
  check("search without a scope looks in the configured default",
    found.items.some((i: any) => i.id === note.id) && found.items.every((i: any) => i.scope === undefined), found);

  await call(c, "fyi_capture", { type: "task", title: "Book the appointment", next_action_at: dayOffset(0) });
  const today = await call(c, "fyi_today");
  check("today without a scope uses the configured default", today.scope === "personal", today);

  const work = await call(c, "fyi_capture", { type: "note", title: "Team offsite", content: "x", scope: "work" });
  const everything = await call(c, "fyi_search", { scope: "all" });
  check("an item outside the default names its scope",
    everything.items.find((i: any) => i.id === work.id)?.scope === "work", everything);

  const listed = await c.listTools();
  const capture = listed.tools.find((t) => t.name === "fyi_capture") as any;
  check("tool descriptions name the configured default",
    capture.inputSchema.properties.scope.description.includes("Defaults to personal"), capture.inputSchema.properties.scope);
  await c.close();

  const typo = tempStore("config-typo");
  let refused = false;
  try {
    const bad = await connect(typo, { defaultScope: "personl" });
    await call(bad, "fyi_search", {});
    await bad.close();
  } catch {
    refused = true;
  }
  check("an unknown default scope stops the server instead of writing elsewhere", refused);
}
