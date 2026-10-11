/** `fyi_capture` — create an item. */

import { stampCompletion } from "../completion.js";
import { DEFAULT_SCOPE } from "../config.js";
import { ToolError } from "../errors.js";
import { projectFolder } from "../folders.js";
import { isMirrored } from "../freshness.js";
import { authoredId, keyedId } from "../identity.js";
import { deriveFromKey, findByKey, keyField } from "../keys.js";
import { checkRefs } from "../refs.js";
import { applyDefaults, unionProperties, validate } from "../schema.js";
import { write } from "../store.js";
import { nowIso } from "../time.js";
import { ITEM_TYPES, SCOPES, type Item, type ItemType, type Scope } from "../types.js";
import type { Tool } from "./tool.js";

/**
 * Creates an item, generating its id and timestamps.
 *
 * Capture has to be cheap or it does not happen, so everything the
 * server can work out for itself is not asked for.
 */
function handler(args: Record<string, any>) {
  const { type, scope = DEFAULT_SCOPE, slug, ...fields } = args;

  if (!ITEM_TYPES.includes(type)) {
    throw new ToolError(`type must be one of: ${ITEM_TYPES.join(", ")}`);
  }
  if (!SCOPES.includes(scope)) {
    throw new ToolError(`scope must be one of: ${SCOPES.join(", ")}`);
  }
  if (typeof fields.title !== "string" || !fields.title.trim()) {
    throw new ToolError("title is required");
  }

  for (const key of Object.keys(fields)) {
    if (fields[key] === undefined) delete fields[key];
  }

  // A mirrored item is named after what it mirrors, and exists once.
  let id: string;
  const key = keyField(type as ItemType);
  if (key) {
    if (fields[key] === undefined) throw new ToolError(`${key} is required on a ${type}: it identifies the item`);
    const parts = deriveFromKey(type as ItemType, fields);
    const existing = findByKey(type as ItemType, parts);
    if (existing) {
      throw new ToolError(`already tracked as "${existing.item.id}"; change it with fyi_update instead`);
    }
    if (slug !== undefined) throw new ToolError(`a ${type} is named after its ${key}; no slug needed`);
    id = keyedId(type as ItemType, parts);
  } else {
    id = authoredId(type as ItemType, fields.title, slug);
  }

  validate(type as ItemType, { ...fields, id: "placeholder", type });
  checkRefs(type as ItemType, fields);
  applyDefaults(type as ItemType, fields);

  const now = nowIso();
  const item: Item = {
    // A mirrored item is created from a fetch, so it starts confirmed.
    ...(isMirrored(type as ItemType) ? { synced_at: now } : {}),
    ...fields,
    id,
    type: type as ItemType,
    title: fields.title.trim(),
    created_at: now,
    updated_at: now,
  };

  stampCompletion(item, undefined, fields, now);

  const stored = write(item, scope as Scope);
  const folder = projectFolder(stored);
  return { id: item.id, type: item.type, path: stored.path, ...(folder ? { folder } : {}) };
}

export const captureTool: Tool = {
  definition: {
    name: "fyi_capture",
    description:
      "Store something durable: a task (needs doing), a note (worth remembering, including a decision and its reasoning), a project (work spanning sessions), or a pr (tracked pull request). Tasks require next_action_at — if there is no next action, it is a note.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: [...ITEM_TYPES] },
        scope: {
          type: "string",
          enum: [...SCOPES],
          description: `Which store this belongs in. Defaults to ${DEFAULT_SCOPE}.`,
        },
        slug: {
          type: "string",
          description:
            "(task, note, project) Choose the id instead of deriving it from the title: \"jay\" gives project-jay. Worth it for an id you will type. A pr is named after its url.",
        },
        ...unionProperties(),
      },
      required: ["type", "title"],
    },
  },
  handler,
};
