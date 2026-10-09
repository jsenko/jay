/** Contract every tool module implements. */

/** An MCP tool: its advertised definition plus its handler. */
export interface Tool {
  definition: {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  };
  handler(args: Record<string, any>): Promise<unknown> | unknown;
}
