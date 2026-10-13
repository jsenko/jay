/** Shared helpers for the pr test suites. */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The server entry point under test. */
export const SERVER = join(HERE, "..", "server.ts");

/** The plugin's own tsx, as `.mcp.json` runs it. */
export const TSX = join(HERE, "..", "..", "node_modules", ".bin", "tsx");

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

/** A scratch directory, so suites never touch real state. */
export function tempDir(label: string): string {
  return mkdtempSync(join(tmpdir(), `pr-${label}-`));
}

/** A connected server, the events it has pushed, and its hellos. */
export interface Connection {
  client: Client;
  pushes: any[];
  hellos: number;
}

/**
 * Starts the server against a fake GitHub and connects a client, keeping
 * the channel pushes it sends. Polls every second so tests don't wait.
 */
export async function connect(apiUrl: string, stateFile: string, repos = "acme/widgets"): Promise<Connection> {
  const conn: Connection = { client: new Client({ name: "pr-test", version: "0" }, { capabilities: {} }), pushes: [], hellos: 0 };
  conn.client.fallbackNotificationHandler = async (n: any) => {
    if (n.method !== "notifications/claude/channel") return;
    const content = JSON.parse(n.params.content);
    if (content.github === "hello") conn.hellos++;
    else conn.pushes.push(content);
  };
  const client = conn.client;
  await client.connect(
    new StdioClientTransport({
      command: TSX,
      args: [SERVER],
      env: {
        ...process.env,
        GITHUB_API_URL: apiUrl,
        GITHUB_TOKEN: "test-token",
        GITHUB_REPOS: repos,
        STATE_FILE: stateFile,
        POLL_INTERVAL: "1",
        MAX_EVENT_AGE: "24",
      } as Record<string, string>,
      stderr: "ignore",
    })
  );
  return conn;
}

/** Calls a tool, returning parsed JSON, or `{ error }` for a tool error. */
export async function call(client: Client, name: string, args: Record<string, unknown> = {}): Promise<any> {
  const res: any = await client.callTool({ name, arguments: args });
  const text = res.content[0].text;
  return res.isError ? { error: text } : JSON.parse(text);
}

/** Waits until `cond` holds, or gives up after `ms`; true if it held. */
export async function until(cond: () => boolean, ms = 8000): Promise<boolean> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (cond()) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return cond();
}

/** Waits until the server has finished a round of polling repository events. */
export async function firstRound(client: Client, ms = 8000): Promise<void> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const status = await call(client, "get_status");
    if (status.sources?.repo_events?.lastSuccessAt) return;
    await new Promise((r) => setTimeout(r, 200));
  }
}

/** Waits a fixed time, for asserting that something did not happen. */
export function settle(ms = 2500): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
