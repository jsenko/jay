/** Shared helpers for the crew test suites. */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The server entry point under test. */
export const SERVER = join(HERE, "..", "server.ts");

/** The plugin's own tsx, as `.mcp.json` runs it. */
export const TSX = join(HERE, "..", "..", "node_modules", ".bin", "tsx");

/** The repository `REPO_DIR` claims to be a checkout of. */
export const REPO = "example/widgets";

/**
 * A scratch git checkout with a known remote, so repo detection has something
 * to find wherever the tests run.
 */
export const REPO_DIR = (() => {
  const dir = join(mkdtempSync(join(tmpdir(), "crew-repo-")), "widgets");
  execFileSync("git", ["init", "-q", dir]);
  execFileSync("git", ["remote", "add", "origin", `https://github.com/${REPO}.git`], { cwd: dir });
  return dir;
})();

let failed = 0;

/** Records one assertion. */
export function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) {
    console.log(`  ok    ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail !== undefined ? ` -> ${JSON.stringify(detail)}` : ""}`);
  }
}

/** Total failures across every suite run so far. */
export function failures(): number {
  return failed;
}

/** Prints a suite heading. */
export function section(name: string): void {
  console.log(`\n${name}`);
}

/** An isolated state directory, so suites cannot see each other's board. */
export function tempCrewDir(label: string): string {
  return mkdtempSync(join(tmpdir(), `crew-${label}-`));
}

/** A scratch directory that is deliberately not a git repository. */
export function tempWorkDir(): string {
  return mkdtempSync(join(tmpdir(), "crew-work-"));
}

/**
 * Starts a server subprocess and connects a client to it over stdio. `env`
 * adds variables, such as a shorter heartbeat.
 */
export async function connect(cwd: string, crewDir: string, env: Record<string, string> = {}): Promise<Client> {
  const client = new Client({ name: "crew-test", version: "0" }, { capabilities: {} });
  await client.connect(
    new StdioClientTransport({
      command: TSX,
      args: [SERVER],
      cwd,
      env: { ...process.env, CREW_DIR: crewDir, ...env },
    })
  );
  return client;
}

/** Calls a tool, returning parsed JSON or `{ error }` for tool errors. */
export async function call(
  client: Client,
  name: string,
  args: Record<string, unknown> = {}
): Promise<any> {
  const res: any = await client.callTool({ name, arguments: args });
  const text = res.content[0].text;
  return res.isError ? { error: text } : JSON.parse(text);
}

/** Waits for asynchronous effects such as disconnect handling. */
export function settle(ms = 1200): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Rewrites the state file directly, to set up conditions that would
 * otherwise take hours, such as a session last seen long ago. Only safe
 * between calls, when no server is writing.
 */
export function editState(crewDir: string, fn: (state: any) => void): void {
  const file = join(crewDir, "state.json");
  const state = JSON.parse(readFileSync(file, "utf8"));
  fn(state);
  writeFileSync(file, JSON.stringify(state, null, 2));
}

/** An ISO timestamp `hours` before now. */
export function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}
