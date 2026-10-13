/** The store's format version: recorded, migrated from, and protected from older servers. */

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { call, check, connect, section, tempStore } from "./harness.js";

const MIGRATE = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "migrate.ts");

/** The version recorded in a store, or undefined. */
function recorded(store: string): number | undefined {
  try {
    return JSON.parse(readFileSync(join(store, "store.json"), "utf8")).version;
  } catch {
    return undefined;
  }
}

/** Runs the migration hook on `store` with stand-in migrations; returns what ran, or the error. */
function migrate(store: string, current: number, ...versions: number[]): string {
  try {
    return execFileSync("npx", ["tsx", MIGRATE, String(current), ...versions.map(String)],
      { env: { ...process.env, FYI_DIR: store }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e: any) {
    return `error: ${e.stderr}`;
  }
}

/**
 * Once others use fyi, a schema change has to reach stores it can't see.
 * This is the hook that will carry it, and the guard that keeps an older
 * fyi from writing into a newer store.
 */
export async function run(): Promise<void> {
  section("store version");

  const fresh = tempStore("version-fresh");
  const c = await connect(fresh);
  await call(c, "fyi_search", {});
  check("a new store records the current format", recorded(fresh) === 1, recorded(fresh));
  await c.close();

  const older = tempStore("version-older");
  mkdirSync(join(older, "default", "note"), { recursive: true });
  writeFileSync(join(older, "default", "note", "note-kept.md"), "---\nid: note-kept\ntype: note\ntitle: Kept\ncreated_at: 2026-10-01T00:00:00.000Z\nupdated_at: 2026-10-01T00:00:00.000Z\n---\nBody.\n");
  const o = await connect(older);
  check("a store from before versioning is taken as format 1, items intact",
    recorded(older) === 1 && (await call(o, "fyi_get", { id: "note-kept" })).title === "Kept");
  await o.close();

  const newer = tempStore("version-newer");
  writeFileSync(join(newer, "store.json"), JSON.stringify({ version: 99 }));
  const n = await connect(newer);
  const refused = await call(n, "fyi_capture", { type: "note", title: "Not written", content: "x" });
  check("a newer store refuses writes, saying to update", refused.error?.includes("Update the fyi plugin"), refused);
  check("but can still be read", typeof (await call(n, "fyi_search", {})).count === "number");
  check("and its version is left alone", recorded(newer) === 99);
  await n.close();

  const migrating = tempStore("version-migrate");
  writeFileSync(join(migrating, "store.json"), JSON.stringify({ version: 1 }));
  const first = migrate(migrating, 3, 2, 3);
  check("pending migrations run in order, each recorded", first.trim() === "ran 2\nran 3" && recorded(migrating) === 3, first);
  check("and never twice", migrate(migrating, 3, 2, 3).trim() === "", recorded(migrating));
  check("a gap in the migrations stops the server", migrate(tempStore("version-gap"), 3, 2).startsWith("error:"));
}
