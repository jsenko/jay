/** Tool registry: the single place a new fyi tool gets wired in. */

import { captureTool } from "./capture.js";
import { convertTool } from "./convert.js";
import { getTool } from "./get.js";
import { handoffTool } from "./handoff.js";
import { linkTool } from "./link.js";
import { searchTool } from "./search.js";
import { todayTool } from "./today.js";
import { updateTool } from "./update.js";
import type { Tool } from "./tool.js";

/** Every tool this server exposes, in the order they are advertised. */
export const tools: Tool[] = [
  captureTool,
  todayTool,
  searchTool,
  getTool,
  updateTool,
  linkTool,
  handoffTool,
  convertTool,
];

/** Lookup used by the call dispatcher. */
export const toolsByName = new Map(tools.map((tool) => [tool.definition.name, tool]));
