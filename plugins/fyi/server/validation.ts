/** Small argument checks shared by tool handlers. */

import { ToolError } from "./errors.js";

/** Requires a non-empty string argument. */
export function requireString(value: unknown, field: string): string {
  const text = String(value ?? "").trim();
  if (!text) throw new ToolError(`${field} is required`);
  return text;
}
