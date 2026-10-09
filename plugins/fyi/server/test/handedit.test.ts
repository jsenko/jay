/** Markdown stays the source of truth: edits made outside the server. */

import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

import { call, check, connect, dayOffset, section, tempStore } from "./harness.js";

/**
 * The store is only worth keeping in markdown if editing a file by hand
 * actually works, so this exercises the path the design depends on.
 */
export async function run(): Promise<void> {
  section("hand edits");

  const store = tempStore("handedit");
  const c = await connect(store);

  const task = await call(c, "fyi_capture", {
    type: "task",
    title: "Review release notes",
    next_action_at: dayOffset(3),
  });

  // Edit the file directly, the way a person with an editor would.
  const edited = `---
id: ${task.id}
type: task
title: Review release notes carefully
status: blocked
created_at: 2026-09-01T10:00:00.000Z
updated_at: 2026-09-01T10:00:00.000Z
next_action_at: ${dayOffset(3)}
blocked_on: waiting on the 3.3.2 tag
tags:
  - release
---

Rewritten by hand.
`;
  writeFileSync(task.path, edited);

  const seen = await call(c, "fyi_get", { id: task.id });
  check("hand-edited title is picked up", seen.title === "Review release notes carefully", seen.title);
  check("hand-added field is picked up", seen.blocked_on === "waiting on the 3.3.2 tag", seen);
  check("hand-edited body is picked up", seen.description === "Rewritten by hand.", seen.description);
  check("hand-added tag is searchable", (await call(c, "fyi_search", { where: { tags: "release" } })).count === 1);

  // A later tool write must preserve what the person wrote.
  await call(c, "fyi_update", { id: task.id, priority: "high" });
  const merged = await call(c, "fyi_get", { id: task.id });
  check("tool update keeps hand-edited fields", merged.blocked_on === "waiting on the 3.3.2 tag", merged);
  check("tool update keeps hand-edited body", merged.description === "Rewritten by hand.", merged.description);

  // A file created entirely by hand, never seen by the server.
  const dir = join(store, "default", "note");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "note-written-by-hand.md"), `---
id: note-written-by-hand
type: note
title: Written entirely by hand
created_at: 2026-09-02T09:00:00.000Z
updated_at: 2026-09-02T09:00:00.000Z
---

Dropped into the directory with an editor.
`);
  const found = await call(c, "fyi_search", { text: "entirely by hand" });
  check("a file the server never wrote is indexed", found.items[0]?.id === "note-written-by-hand", found);

  // A file deleted outside the server must leave the index.
  unlinkSync(join(dir, "note-written-by-hand.md"));
  check("a deleted file leaves the index", (await call(c, "fyi_search", { text: "entirely by hand" })).count === 0);

  // An unparseable file must not take the store down with it.
  writeFileSync(join(dir, "note-broken.md"), "---\nthis: [is not: valid yaml\n---\n");
  const stillWorks = await call(c, "fyi_search", { type: ["task"] });
  check("a corrupt file does not hide the rest", stillWorks.count === 1, stillWorks);

  await c.close();
}
