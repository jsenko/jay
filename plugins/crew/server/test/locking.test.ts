/** Cross-process locking of the shared state file. */

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { check, section, tempCrewDir, TSX } from "./harness.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKER = join(HERE, "..", "lock-worker.ts");

const WORKERS = 6;
const PER_WORKER = 10;

/**
 * One server process runs per session, so concurrent writers are the
 * normal case rather than an edge case. A lost update here would corrupt
 * job claims.
 */
export async function run(): Promise<void> {
  section("locking");

  const crewDir = tempCrewDir("locking");
  process.env.CREW_DIR = crewDir;
  const store = await import("../store.js");

  await Promise.all(
    Array.from({ length: WORKERS }, () =>
      new Promise<void>((resolve, reject) => {
        const child = spawn(TSX, [WORKER, String(PER_WORKER)], {
          cwd: join(HERE, ".."),
          env: { ...process.env, CREW_DIR: crewDir },
          stdio: "ignore",
        });
        child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`worker exited ${code}`))));
      })
    )
  );

  const seq = store.read().seq;
  check("concurrent processes lose no updates", seq === WORKERS * PER_WORKER, {
    seq,
    expected: WORKERS * PER_WORKER,
  });
}
