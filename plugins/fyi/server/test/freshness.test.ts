/** Freshness of mirrored items. */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { call, check, connect, dayOffset, section, tempStore } from "./harness.js";

/**
 * A mirrored item can be *wrong*, not merely old, and the store cannot
 * tell on its own — so the warning has to reach every reader without
 * being asked for.
 */
export async function run(): Promise<void> {
  section("freshness");

  const store = tempStore("freshness");
  const c = await connect(store);

  // --- authored items are never stale --------------------------------
  const task = await call(c, "fyi_capture", {
    type: "task", title: "Authored work", next_action_at: dayOffset(1),
  });
  const gotTask = await call(c, "fyi_get", { id: task.id });
  check("an authored item has no freshness block", gotTask.freshness === undefined, gotTask);
  check("an authored item carries no synced_at", gotTask.synced_at === undefined, gotTask);

  // --- a mirrored item starts confirmed ------------------------------
  const pr = await call(c, "fyi_capture", {
    type: "pr", title: "fix: retry", url: "https://github.com/acme/widgets/pull/8676",
    lifecycle: "ready-for-review", attention: true,
  });
  const fresh = await call(c, "fyi_get", { id: pr.id });
  check("capture stamps synced_at", typeof fresh.synced_at === "string", fresh);
  check("a fresh mirrored item is not stale", fresh.freshness?.stale === false, fresh.freshness);
  check("freshness names the source", fresh.freshness?.source === "GitHub", fresh.freshness);

  const freshSearch = await call(c, "fyi_search", { type: ["pr"] });
  check("a fresh item carries no warning in search", freshSearch.items[0]?.stale === undefined, freshSearch.items[0]);

  // --- going stale ---------------------------------------------------
  // Backdate on disk, the way a watcher being down for a day looks.
  const path = join(store, "default", "pr", `${pr.id}.md`);
  const old = new Date(Date.now() - 30 * 3_600_000).toISOString();
  writeFileSync(path, `---
id: ${pr.id}
type: pr
title: "fix: retry"
created_at: ${old}
updated_at: ${old}
synced_at: ${old}
number: 8676
repo: acme/widgets
lifecycle: ready-for-review
attention: true
---
`);

  const stale = await call(c, "fyi_get", { id: pr.id });
  check("past the window it reports stale", stale.freshness?.stale === true, stale.freshness);
  check("it says how old", stale.freshness?.age_hours >= 29, stale.freshness);
  check("the note says what to do", /refresh before acting/.test(stale.freshness?.note ?? ""), stale.freshness?.note);

  const staleSearch = await call(c, "fyi_search", { type: ["pr"] });
  check("search warns without being asked", typeof staleSearch.items[0]?.stale === "string", staleSearch.items[0]);

  const staleToday = await call(c, "fyi_today");
  check("today warns too", typeof staleToday.prs_needing_attention[0]?.stale === "string", staleToday.prs_needing_attention[0]);

  // --- clearing it ---------------------------------------------------
  const localEdit = await call(c, "fyi_update", { id: pr.id, complexity: "simple" });
  check("a local edit does not claim freshness", localEdit.synced_at === undefined, localEdit);
  check("so it is still stale", (await call(c, "fyi_get", { id: pr.id })).freshness.stale === true);

  const resync = await call(c, "fyi_update", { id: pr.id, lifecycle: "merged", synced: true });
  check("syncing stamps synced_at", typeof resync.synced_at === "string", resync);
  const after = await call(c, "fyi_get", { id: pr.id });
  check("and clears the warning", after.freshness.stale === false, after.freshness);
  check("the synced value is what was written", after.lifecycle === "merged", after);

  // --- never confirmed ------------------------------------------------
  const handmade = join(store, "default", "pr", "pr-by-hand.md");
  writeFileSync(handmade, `---
id: pr-by-hand
type: pr
title: Added by hand
created_at: ${new Date().toISOString()}
updated_at: ${new Date().toISOString()}
number: 9999
repo: acme/widgets
---
`);
  const unconfirmed = await call(c, "fyi_get", { id: "pr-by-hand" });
  check("never confirmed counts as stale", unconfirmed.freshness?.stale === true, unconfirmed.freshness);
  check("even when just written", unconfirmed.freshness?.synced_at === null, unconfirmed.freshness);
  check("and says so plainly", /never confirmed/.test(unconfirmed.freshness?.note ?? ""), unconfirmed.freshness?.note);

  await c.close();
}
