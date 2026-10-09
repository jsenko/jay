/**
 * A caller mistake, reported back as an MCP tool error.
 *
 * Messages are written for a model to act on: they name the field, say
 * what was wrong, and where useful list what would have been accepted.
 */
export class ToolError extends Error {}
