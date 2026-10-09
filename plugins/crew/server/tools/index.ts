/** Tool registry: the single place a new crew tool gets wired in. */

import { claimTool } from "./claim.js";
import { extendTool } from "./extend.js";
import { joinTool } from "./join.js";
import { leaveTool } from "./leave.js";
import { pollTool } from "./poll.js";
import { postTool } from "./post.js";
import { resolveTool } from "./resolve.js";
import { sendTool } from "./send.js";
import { stateTool } from "./state.js";
import { whoTool } from "./who.js";
import type { Tool } from "./tool.js";

/** Every tool this server exposes, in the order they are advertised. */
export const tools: Tool[] = [
  joinTool,
  leaveTool,
  whoTool,
  stateTool,
  sendTool,
  postTool,
  pollTool,
  claimTool,
  resolveTool,
  extendTool,
];

/** Lookup used by the call dispatcher. */
export const toolsByName = new Map(tools.map((tool) => [tool.definition.name, tool]));
