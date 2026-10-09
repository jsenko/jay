/** Shared helpers for the fyi test suites. */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The server entry point under test. */
export const SERVER = join(HERE, "..", "server.ts");

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

/** An isolated store, so suites never touch the real one. */
export function tempStore(label: string): string {
  return mkdtempSync(join(tmpdir(), `fyi-${label}-`));
}

/**
 * Starts a server subprocess and connects a client to it over stdio, with `config`
 * as the store's config.json when given.
 */
export async function connect(fyiDir: string, config?: unknown): Promise<Client> {
  if (config !== undefined) writeFileSync(join(fyiDir, "config.json"), JSON.stringify(config));
  const client = new Client({ name: "fyi-test", version: "0" }, { capabilities: {} });
  await client.connect(
    new StdioClientTransport({
      command: "npx",
      args: ["tsx", SERVER],
      env: { ...process.env, FYI_DIR: fyiDir },
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

/** The tool definitions the server advertises. */
export async function listTools(client: Client): Promise<any[]> {
  return (await client.listTools()).tools as any[];
}

/** Today as YYYY-MM-DD. */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** A date offset from today, for due and next-action fields. */
export function dayOffset(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}
