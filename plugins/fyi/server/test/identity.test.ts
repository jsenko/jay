/** Naming: keyed ids for mirrored items, slugs for authored ones, and the rename migration. */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { call, check, connect, dayOffset, section, tempStore } from "./harness.js";

const MIGRATION = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations", "key-ids.ts");

/** Exercises both naming conventions and the migration between them. */
export async function run(): Promise<void> {
  section("identity");

  const store = tempStore("identity");
  const c = await connect(store);

  // --- a pr is named after its url ----------------------------------
  const pr = await call(c, "fyi_capture", {
    type: "pr", title: "fix: retry", url: "https://github.com/acme/widgets/pull/9657",
  });
  check("a pr id comes from repo and number", pr.id === "pr-widgets-9657", pr);

  const got = await call(c, "fyi_get", { id: pr.id });
  check("repo is derived from the url", got.repo === "acme/widgets", got);
  check("number is derived from the url", got.number === 9657, got);

  const noUrl = await call(c, "fyi_capture", { type: "pr", title: "x", repo: "acme/widgets", number: 1 });
  check("a pr without a url is refused", noUrl.error?.includes("url is required"), noUrl);

  const badUrl = await call(c, "fyi_capture", { type: "pr", title: "x", url: "https://github.com/acme" });
  check("a url that names no item is refused", badUrl.error?.includes("url must be a link"), badUrl);

  const mismatch = await call(c, "fyi_capture", {
    type: "pr", title: "x", url: "https://github.com/acme/widgets/pull/1", number: 2,
  });
  check("a number disagreeing with the url is refused", mismatch.error?.includes("number is"), mismatch);

  // --- duplicates are caught by key, not by id -----------------------
  const again = await call(c, "fyi_capture", {
    type: "pr", title: "a different title", url: "https://GitHub.com/Acme/Widgets/pull/9657/",
  });
  check("the same PR cannot be captured twice", again.error?.includes(`already tracked as "${pr.id}"`), again);

  // --- detail is added only when the short id is taken ---------------
  const otherOwner = await call(c, "fyi_capture", {
    type: "pr", title: "y", url: "https://github.com/someone/widgets/pull/9657",
  });
  check("another owner's repo of the same name gets the owner", otherOwner.id === "pr-someone-widgets-9657", otherOwner);

  const otherHost = await call(c, "fyi_capture", {
    type: "pr", title: "z", url: "https://github.example.com/someone/widgets/pull/9657",
  });
  check("another host gets the host", otherHost.id === "pr-github-example-com-someone-widgets-9657", otherHost);

  // --- what a pr stands for cannot change ----------------------------
  const moved = await call(c, "fyi_update", { id: pr.id, url: "https://github.com/acme/widgets/pull/1" });
  check("an update cannot change the url", moved.error?.includes("cannot change"), moved);

  const renumbered = await call(c, "fyi_update", { id: pr.id, number: 1 });
  check("an update cannot change a derived field", renumbered.error?.includes("number"), renumbered);

  const same = await call(c, "fyi_update", { id: pr.id, url: "https://github.com/acme/widgets/pull/9657", lifecycle: "merged" });
  check("repeating the same url is fine", same.error === undefined, same);

  // --- authored items: title slugs, cut at a word ---------------------
  const long = await call(c, "fyi_capture", {
    type: "note", title: "Watcher resume: queued PR review jobs and pending follow-ups", content: "x",
  });
  check("a long title is cut at a word boundary", long.id === "note-watcher-resume-queued-pr-review-jobs-and", long);

  const chosen = await call(c, "fyi_capture", {
    type: "project", title: "jay: prepare for publishing", description: "x", slug: "jay",
  });
  check("an explicit slug names the item", chosen.id === "project-jay", chosen);

  const taken = await call(c, "fyi_capture", { type: "project", title: "x", description: "x", slug: "jay" });
  check("a taken slug is an error, not a silent -2", taken.error?.includes("already taken"), taken);

  const badSlug = await call(c, "fyi_capture", { type: "task", title: "x", next_action_at: dayOffset(1), slug: "Not A Slug" });
  check("a malformed slug is refused", badSlug.error?.includes("slug must be"), badSlug);

  const prSlug = await call(c, "fyi_capture", {
    type: "pr", title: "w", url: "https://github.com/acme/widgets/pull/7", slug: "mine",
  });
  check("a pr takes no slug", prSlug.error?.includes("no slug needed"), prSlug);

  await c.close();

  // --- the migration renames title-named prs, and their references ----
  const old = tempStore("migrate");
  mkdirSync(join(old, "work", "pr"), { recursive: true });
  mkdirSync(join(old, "work", "note"), { recursive: true });
  writeFileSync(join(old, "work", "pr", "pr-fix-something.md"), `---
id: pr-fix-something
type: pr
title: "fix: something"
url: https://github.com/acme/widgets/pull/42
repo: acme/widgets
number: 42
created_at: 2026-10-01T00:00:00.000Z
updated_at: 2026-10-01T00:00:00.000Z
---
`);
  writeFileSync(join(old, "work", "note", "note-about-it.md"), `---
id: note-about-it
type: note
title: About it
links:
  - id: pr-fix-something
    rel: relates-to
created_at: 2026-10-01T00:00:00.000Z
updated_at: 2026-10-01T00:00:00.000Z
---
Context.
`);

  const output = execFileSync("npx", ["tsx", MIGRATION], { env: { ...process.env, FYI_DIR: old }, encoding: "utf8" });
  check("the migration reports the rename", output.includes("pr-fix-something -> pr-widgets-42"), output);
  check("the old file is gone", !existsSync(join(old, "work", "pr", "pr-fix-something.md")));

  const m = await connect(old);
  const renamedPr = await call(m, "fyi_get", { id: "pr-widgets-42" });
  check("the item lives under its new id", renamedPr.title === "fix: something", renamedPr);
  const note = await call(m, "fyi_get", { id: "note-about-it" });
  check("links to it follow the rename", note.links?.[0]?.id === "pr-widgets-42", note.links);
  await m.close();

  const rerun = execFileSync("npx", ["tsx", MIGRATION], { env: { ...process.env, FYI_DIR: old }, encoding: "utf8" });
  check("running it again changes nothing", rerun.includes("0 renamed"), rerun);
}
