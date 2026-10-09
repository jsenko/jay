/** `fyi_search` — find items. */

import { DEFAULT_SCOPE } from "../config.js";
import { ToolError } from "../errors.js";
import { search, summarise, type Query } from "../query.js";
import { all } from "../store.js";
import { ITEM_TYPES, SCOPES, type ItemType } from "../types.js";
import { validateWhere, whereInputSchema } from "../where.js";
import type { Tool } from "./tool.js";

/**
 * Accepted inputs. Anything else is refused rather than ignored: an
 * ignored filter returns everything, which reads as an answer.
 */
const INPUTS = new Set(["scope", "type", "text", "where", "include_archived", "limit"]);

/**
 * Replaces the hand-maintained YAML indexes entirely: the index was only
 * ever there because there was no way to ask a question of the store.
 */
function handler(args: Record<string, any>) {
  for (const name of Object.keys(args)) {
    if (!INPUTS.has(name)) {
      throw new ToolError(`"${name}" is not a search input; field conditions go in where, e.g. where: {${name}: ...}`);
    }
  }

  const types: ItemType[] | undefined = args.type;
  const query: Query = {
    scope: args.scope,
    type: types,
    text: args.text,
    where: args.where === undefined ? undefined : validateWhere(args.where, types?.length ? types : undefined),
    include_archived: args.include_archived,
    limit: args.limit,
  };
  const found = search(all(Boolean(args.include_archived)), query);
  return { count: found.length, items: found.map(summarise) };
}

export const searchTool: Tool = {
  definition: {
    name: "fyi_search",
    description:
      "Find items by type, text, and conditions on any field. Returns summaries; use fyi_get for the full text of one.",
    inputSchema: {
      type: "object",
      properties: {
        scope: {
          type: "string",
          enum: [...SCOPES, "all"],
          description: `Which store to look in. Defaults to ${DEFAULT_SCOPE}; use "all" only when the question genuinely spans several.`,
        },
        type: {
          type: "array",
          items: { type: "string", enum: [...ITEM_TYPES] },
          description: "Restrict to these types.",
        },
        text: { type: "string", description: "Substring of the title or body." },
        where: whereInputSchema(),
        include_archived: { type: "boolean", description: "Include archived items." },
        limit: { type: "number" },
      },
    },
  },
  handler,
};
