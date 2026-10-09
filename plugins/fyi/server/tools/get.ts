/** `fyi_get` — read one item in full. */

import { ToolError } from "../errors.js";
import { freshnessOf } from "../freshness.js";
import { get } from "../store.js";
import { requireString } from "../validation.js";
import type { Tool } from "./tool.js";

/**
 * Returns the whole item, including its prose body.
 *
 * For a mirrored type the reply carries a `freshness` block saying when
 * it was last confirmed against its source. Reading an item is exactly
 * the moment to learn it may be out of date.
 */
function handler(args: Record<string, any>) {
  const id = requireString(args.id, "id");
  const stored = get(id);
  if (!stored) throw new ToolError(`no item with id "${id}"`);

  const freshness = freshnessOf(stored.item);
  return freshness ? { ...stored.item, freshness } : stored.item;
}

export const getTool: Tool = {
  definition: {
    name: "fyi_get",
    description: "Read one item in full, including its long text.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  handler,
};
