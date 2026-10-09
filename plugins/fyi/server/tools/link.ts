/** `fyi_link` — relate two items. */

import { ToolError } from "../errors.js";
import { addLink, inverseOf } from "../links.js";
import { get, write } from "../store.js";
import { nowIso } from "../time.js";
import type { Link } from "../types.js";
import { requireString } from "../validation.js";
import type { Tool } from "./tool.js";

const RELS: Link["rel"][] = ["parent", "child", "blocks", "blocked-by", "relates-to", "from"];

/**
 * Writes the relationship on both items where it has an inverse, so the
 * link is discoverable from either end rather than only from whichever
 * one happened to be edited.
 */
function handler(args: Record<string, any>) {
  const fromId = requireString(args.from, "from");
  const toId = requireString(args.to, "to");
  const rel = args.rel as Link["rel"];

  if (!RELS.includes(rel)) throw new ToolError(`rel must be one of: ${RELS.join(", ")}`);
  if (fromId === toId) throw new ToolError("an item cannot link to itself");

  const from = get(fromId);
  const to = get(toId);
  if (!from) throw new ToolError(`no item with id "${fromId}"`);
  if (!to) throw new ToolError(`no item with id "${toId}"`);

  const note = typeof args.note === "string" ? args.note : undefined;

  from.item.links = addLink(from.item.links, { id: toId, rel, note });
  from.item.updated_at = nowIso();
  write(from.item, from.scope);

  const inverse = inverseOf(rel);
  if (inverse) {
    to.item.links = addLink(to.item.links, { id: fromId, rel: inverse, note });
    to.item.updated_at = nowIso();
    write(to.item, to.scope);
  }

  return { from: fromId, to: toId, rel, inverse };
}

export const linkTool: Tool = {
  definition: {
    name: "fyi_link",
    description:
      "Relate two items. The matching relationship is written on the other item automatically, so the link is visible from both ends.",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string" },
        to: { type: "string" },
        rel: { type: "string", enum: [...RELS] },
        note: { type: "string", description: "Why they are related, if it is not obvious." },
      },
      required: ["from", "to", "rel"],
    },
  },
  handler,
};
