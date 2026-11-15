/** Roles: a job names the role that should do it. */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { call, check, connect, section, tempCrewDir, tempWorkDir } from "./harness.js";

/** A jay home with role files, as the plugins' links and the user's own folder lay them out. */
function jayHome(): string {
  const dir = tempWorkDir();
  for (const [plugin, role] of [["pr", "reviewer"], ["pr", "watcher"], ["code", "coder"]]) {
    mkdirSync(join(dir, "plugins", plugin, "roles"), { recursive: true });
    writeFileSync(join(dir, "plugins", plugin, "roles", `${role}.md`), `---\nname: ${role}\n---\n`);
  }
  mkdirSync(join(dir, "roles"));
  writeFileSync(join(dir, "roles", "writer.md"), "---\nname: writer\n---\n");
  return dir;
}

/**
 * Capabilities are a vocabulary of their own: a job needing `docs`
 * matched no session, though a coder would have done it. Roles are what
 * the user starts sessions as, so a poster can name one.
 */
export async function run(): Promise<void> {
  section("roles");

  const crewDir = tempCrewDir("roles");
  const env = { JAY_DIR: jayHome() };
  const watcher = await connect(tempWorkDir(), crewDir, env);
  const coder = await connect(tempWorkDir(), crewDir, env);
  const coder2 = await connect(tempWorkDir(), crewDir, env);
  const reviewer = await connect(tempWorkDir(), crewDir, env);

  await call(watcher, "crew_join", { purpose: "Watching GitHub events", role: "watcher", capabilities: ["watch"] });
  const coderId = (await call(coder, "crew_join", { purpose: "Coding", role: "coder", capabilities: ["code"] })).session_id;
  const coder2Id = (await call(coder2, "crew_join", { purpose: "Coding too", role: "coder", capabilities: ["code"] })).session_id;
  const joined = await call(reviewer, "crew_join", { purpose: "Reviewing PRs", role: "reviewer", capabilities: ["review"] });
  check("a session records the role it started as", joined.role === "reviewer", joined);

  const unknown = await call(watcher, "crew_post", { body: "Write the docs", role: "documenter" });
  check("an unknown role is refused, listing the known ones", unknown.error?.includes("coder, reviewer, watcher, writer"), unknown);
  const stranger = await connect(tempWorkDir(), crewDir, env);
  const badJoin = await call(stranger, "crew_join", { purpose: "x", role: "nope" });
  check("and so is joining as one", badJoin.error?.includes("unknown role"), badJoin);
  await stranger.close();

  const docs = await call(watcher, "crew_post", { body: "Document the new flag", role: "coder" });
  check("a job for a role goes to the sessions in it, whatever they advertise",
    docs.routable && docs.eligible_sessions.sort().join() === [coderId, coder2Id].sort().join(), docs);
  const first = await call(coder2, "crew_claim");
  const second = await call(coder, "crew_claim");
  check("two sessions in the role are a pool: the first claim wins", first.claimed?.id === docs.job_id && second.claimed === null, { first, second });

  await call(watcher, "crew_post", { body: "Review PR 5", role: "reviewer", needs: ["code"] });
  const both = (await call(watcher, "crew_poll", { board: true })).board.find((j: any) => j.body === "Review PR 5");
  check("with needs too, a session must meet both", both?.waiting_on === "no session started as reviewer and advertising code", both);

  const nobody = await call(watcher, "crew_post", { body: "Draft the post", role: "writer" });
  check("a role nobody started as says so", nobody.waiting_on === "no session started as writer", nobody);
  check("and the job shows its role", (await call(watcher, "crew_poll", { board: true })).board.some((j: any) => j.role === "writer"));

  await Promise.all([watcher.close(), coder.close(), coder2.close(), reviewer.close()]);
}
