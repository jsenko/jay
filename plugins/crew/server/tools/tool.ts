/** Contract every tool module implements. */

import { CAPABILITIES } from "../types.js";

/** An MCP tool: its advertised definition plus its handler. */
export interface Tool {
  definition: {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  };
  handler(args: Record<string, any>): Promise<unknown>;
}

/**
 * Shared schema fragment, derived from the enum rather than restated, so
 * the values the model sees cannot drift from the ones the server
 * validates against.
 */
export const CAPABILITY_SCHEMA = {
  type: "array",
  items: { type: "string", enum: [...CAPABILITIES] },
  description: "What kinds of work this session accepts.",
};
