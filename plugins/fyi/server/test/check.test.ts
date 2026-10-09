/** The store checker: reports items that no longer match their schema, and changes nothing. */

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { call, check, connect, section, tempStore } from "./harness.js";

const CHECK = join(dirname(fileURLToPath(import.meta.url)), "..", "check.ts");

/** Runs the checker against a store, returning its exit code and output. */
function runCheck(store: string): { code: number; out: string } {
  try {
    return { code: 0, out: execFileSync("npx", ["tsx", CHECK], { env: { ...process.env, FYI_DIR: store }, encoding: "utf8" }) };
  } catch (err: any) {
    return { code: err.status, out: String(err.stdout) };
  }
}

/** Exercises a clean store, then one with each kind of problem. */
export async function run(): Promise<void> {
  section("check");

  const store = tempStore("check");
  const c = await connect(store);
  const project = await call(c, "fyi_capture", { type: "project", title: "P", description: "x", slug: "p" });
  await call(c, "fyi_capture", { type: "note", title: "N", content: "x", project: project.id });
  await c.close();

  const clean = runCheck(store);
  check("a clean store passes", clean.code === 0 && clean.out.includes("all valid"), clean);

  mkdirSync(join(store, "work", "task"), { recursive: true });
  const bad = join(store, "work", "task", "task-old.md");
  const content = `---
id: task-old
type: task
title: Old
next_action_at: 2026-10-01
retire_after_days: 3
project: project-gone
created_at: 2026-10-01T00:00:00.000Z
updated_at: 2026-10-01T00:00:00.000Z
---
`;
  writeFileSync(bad, content);
  writeFileSync(join(store, "work", "task", "task-misnamed.md"), content.replace("id: task-old", "id: task-other"));

  const dirty = runCheck(store);
  check("problems exit non-zero", dirty.code === 1, dirty);
  check("an unknown field is reported", dirty.out.includes('"retire_after_days" is not a field'), dirty.out);
  check("a dangling reference is reported", dirty.out.includes('no item with id "project-gone"'), dirty.out);
  check("an id not matching its file is reported", dirty.out.includes('id "task-other" does not match the file name'), dirty.out);
  check("every problem with one item is listed, not just the first", (dirty.out.split("task-old.md")[1] ?? "").split("\n  - ").length > 2, dirty.out);
  check("checking changes nothing", readFileSync(bad, "utf8") === content);
}
