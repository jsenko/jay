#!/usr/bin/env npx tsx

/**
 * crew — coordination MCP server. Design and semantics in SPEC.md.
 *
 * This file is wiring only: transport, dispatch, and lifecycle. Tool
 * behaviour lives in `tools/`, domain rules in `sessions.ts` and
 * `messages.ts`, persistence in `store.ts`.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { readFileSync } from "node:fs";

import { getSessionId, setNotificationModeProvider } from "./context.js";
import { startHeartbeat } from "./heartbeat.js";
import { startNotifier } from "./notifications.js";
import { leave } from "./tools/leave.js";
import { tools, toolsByName } from "./tools/index.js";

/** The plugin's version, so the server reports the release it ships in. */
const { version } = JSON.parse(readFileSync(new URL("../.claude-plugin/plugin.json", import.meta.url), "utf8"));

const mcp = new Server(
  { name: "crew", version },
  {
    capabilities: { tools: {}, experimental: { "claude/channel": {} } },
    instructions: [
      "Coordination between concurrent Claude Code sessions.",
      "Call crew_join once at session start, then crew_state when your status or activity changes.",
      "Use crew_who to see what other sessions are doing before duplicating their work.",
      "Set status 'focus' while the user is actively driving this session — the router will not assign work to it.",
      "A crew wake notification means only that something is waiting; call crew_poll to read it.",
    ].join("\n"),
  }
);

setNotificationModeProvider(() => {
  const caps = mcp.getClientCapabilities() as
    | { experimental?: Record<string, unknown> }
    | undefined;
  return caps?.experimental?.["claude/channel"] ? "channel" : "poll";
});

mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map((tool) => tool.definition),
}));

mcp.setRequestHandler(CallToolRequestSchema, async (req) => {
  const tool = toolsByName.get(req.params.name);
  if (!tool) {
    return { content: [{ type: "text", text: `Unknown tool: ${req.params.name}` }], isError: true };
  }

  try {
    const result = await tool.handler((req.params.arguments ?? {}) as Record<string, any>);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (err: any) {
    return { content: [{ type: "text", text: err.message }], isError: true };
  }
});

/**
 * Departure detection (SPEC.md §5). The client disconnecting is the
 * common case, so catching it here leaves the staleness rule to cover
 * only SIGKILL and machine loss.
 */
function shutdown(): void {
  if (!getSessionId()) process.exit(0);
  leave()
    .catch((err) => console.error(`[crew] leave failed: ${err.message}`))
    .finally(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.stdin.on("end", shutdown);

await mcp.connect(new StdioServerTransport());

startHeartbeat();

startNotifier((kind) => {
  mcp.notification({
    method: "notifications/claude/channel",
    params: { content: JSON.stringify({ crew: kind }) },
  });
});
