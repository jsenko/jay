/** A plugin's MCP servers, from Claude Code's `.mcp.json` into opencode's shape. */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** The parsed file, or undefined when it doesn't exist. */
export async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return undefined;
    throw e;
  }
}

/**
 * The servers under their own names, so opencode's tool names
 * (`<server>_<tool>`) don't change: one command array, and `environment`
 * for `env`.
 */
export async function loadMcp(root, substitute) {
  const servers = (await readJson(join(root, ".mcp.json")))?.mcpServers ?? {};
  return Object.fromEntries(Object.entries(servers).map(([server, spec]) => [server, {
    type: "local",
    command: [spec.command, ...(spec.args ?? [])].map(substitute),
    ...(spec.env && {
      environment: Object.fromEntries(Object.entries(spec.env).map(([k, v]) => [k, substitute(v)])),
    }),
  }]));
}
