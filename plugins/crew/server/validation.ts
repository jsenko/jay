/**
 * Argument validation for tool handlers.
 *
 * Everything here fails at the call rather than at the point of use: a
 * bad capability that survives to routing surfaces only as "nobody is
 * available", which gives no hint where to look.
 */

import { ToolError } from "./errors.js";
import { CAPABILITIES, type Capability, type SessionStatus } from "./types.js";

const STATUSES: SessionStatus[] = ["idle", "busy", "focus", "offline"];

/** Validates a capability list against the fixed enum. Absent means none. */
export function validateCapabilities(input: unknown): Capability[] {
  if (input === undefined) return [];
  if (!Array.isArray(input)) throw new ToolError("capabilities must be an array");

  const invalid = input.filter((c) => !CAPABILITIES.includes(c as Capability));
  if (invalid.length > 0) {
    throw new ToolError(
      `unknown capability: ${invalid.join(", ")}. Valid: ${CAPABILITIES.join(", ")}`
    );
  }
  return input as Capability[];
}

/** Validates an optional session status. */
export function validateStatus(input: unknown): SessionStatus | undefined {
  if (input === undefined) return undefined;
  if (!STATUSES.includes(input as SessionStatus)) {
    throw new ToolError(`status must be one of: ${STATUSES.join(", ")}`);
  }
  return input as SessionStatus;
}

/** Requires a non-empty string argument. */
export function requireString(value: unknown, field: string): string {
  const text = String(value ?? "").trim();
  if (!text) throw new ToolError(`${field} is required`);
  return text;
}
