/**
 * A caller mistake, reported back as an MCP tool error.
 *
 * Reserved for genuine misuse. "Nothing to do" is always a normal result
 * so the model never has to read an error string to decide it is idle
 * (SPEC.md §5).
 */
export class ToolError extends Error {}
