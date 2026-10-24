/** `fyi_create_scope` — add a scope. */

import { knownScopes } from "../config.js";
import { createScope } from "../scopes.js";
import type { Tool } from "./tool.js";

/**
 * Creates a scope's directory. Scopes are the directories that exist, so
 * this is all a new one needs; capture and search refuse a scope that
 * doesn't exist, which keeps a typo from becoming one.
 */
function handler(args: Record<string, any>) {
  const scope = createScope(args.name);
  return { scope, scopes: knownScopes() };
}

export const createScopeTool: Tool = {
  definition: {
    name: "fyi_create_scope",
    description:
      "Create a scope: a separate store for items, such as one per job or a side project. Only when the user asks for one; most items belong in an existing scope.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Lowercase letters, digits and hyphens, e.g. \"side-project\"." },
      },
      required: ["name"],
    },
  },
  handler,
};
