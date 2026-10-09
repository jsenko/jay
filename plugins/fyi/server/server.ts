#!/usr/bin/env npx tsx

/**
 * fyi — durable store for tasks, notes, projects and tracked pull
 * requests. Design and semantics in SPEC.md.
 *
 * This file is wiring only: transport, dispatch, lifecycle. Tool
 * behaviour lives in `tools/`, validation in `schema.ts`, persistence in
 * `store.ts`.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import { root } from "./store.js";
import { tools, toolsByName } from "./tools/index.js";

const mcp = new Server(
  { name: "fyi", version: "0.1.0" },
  {
    capabilities: { tools: {} },
    instructions: [
      `Durable store for tasks, notes, projects and tracked pull requests, kept as markdown under ${root}.`,
      "Capture something whenever it matters beyond this session: a decision and its reasoning, work that needs doing later, a project spanning sessions.",
      "A task needs a date to look at it again. If there is no next action, it is a note.",
      "Search before creating — updating an existing item is usually better than adding a second one about the same thing.",
    ].join("\n"),
  }
);

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

await mcp.connect(new StdioServerTransport());
