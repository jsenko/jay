/** `fyi_update` — change fields on an existing item. */

import { ToolError } from "../errors.js";
import { DERIVED_FIELDS, deriveFromKey, keyField, parseKey } from "../keys.js";
import { applyListOps } from "../listops.js";
import { stampCompletion } from "../completion.js";
import { checkRefs } from "../refs.js";
import { unionProperties, validate } from "../schema.js";
import { get, write } from "../store.js";
import { nowIso } from "../time.js";
import { requireString } from "../validation.js";
import type { Tool } from "./tool.js";

/**
 * Refuses a change to what a mirrored item stands for. Its id was built
 * from its key, so a different key is a different item — capture that.
 * Repeating the current values is fine, and an item that never had a key
 * may be given one.
 */
function keepIdentity(item: Record<string, any>, fields: Record<string, unknown>): void {
  const key = keyField(item.type);
  if (!key || [key, ...DERIVED_FIELDS].every((name) => fields[name] === undefined)) return;

  const merged: Record<string, unknown> = { ...fields, [key]: fields[key] ?? item[key] };
  const parts = deriveFromKey(item.type, merged);
  if (item[key] === undefined) {
    Object.assign(fields, merged);
    return;
  }
  if (parseKey(item[key]).canonical !== parts.canonical) {
    throw new ToolError(`${key} identifies this ${item.type} and cannot change; capture the other one instead`);
  }
  for (const name of DERIVED_FIELDS) {
    if (fields[name] !== undefined && String(fields[name]).toLowerCase() !== String(item[name]).toLowerCase()) {
      throw new ToolError(`${name} is derived from ${key} and cannot change`);
    }
  }
}

/**
 * Applies the supplied fields and leaves the rest alone.
 *
 * Replaces the read-parse-sed-write cycle that two sessions could
 * previously run over the same file at once.
 */
function handler(args: Record<string, any>) {
  const { id: rawId, synced, add, remove, ...fields } = args;
  const id = requireString(rawId, "id");

  const stored = get(id);
  if (!stored) throw new ToolError(`no item with id "${id}"`);

  for (const key of Object.keys(fields)) {
    if (fields[key] === undefined) delete fields[key];
  }
  // Confirming an unchanged item is an update of its own: it stamps synced_at only.
  const changes = Object.keys(fields).length > 0 || add !== undefined || remove !== undefined;
  if (!changes && synced !== true) throw new ToolError("no fields to update");
  if (fields.type !== undefined) throw new ToolError("type cannot be changed; use fyi_convert");
  for (const name of [...Object.keys(add ?? {}), ...Object.keys(remove ?? {})]) {
    if (fields[name] !== undefined) throw new ToolError(`${name} is both set and changed by add/remove; use one`);
  }

  validate(stored.item.type, fields, { partial: true });
  checkRefs(stored.item.type, fields);
  // Only the entries being added: one already in the list was valid when written.
  checkRefs(stored.item.type, Object.fromEntries(Object.entries(add ?? {}).map(([k, v]) => [k, [v].flat()])));
  keepIdentity(stored.item, fields);
  Object.assign(fields, applyListOps(stored.item, add, remove));

  const now = nowIso();
  const updated = { ...stored.item, ...fields, updated_at: changes ? now : stored.item.updated_at };
  stampCompletion(updated, stored.item, fields, now);

  // Only an explicit claim counts. A local edit must not make a stale
  // record look freshly confirmed.
  if (synced === true) updated.synced_at = now;

  write(updated, stored.scope);

  return {
    id,
    updated: Object.keys(fields).sort(),
    ...(synced === true ? { synced_at: now } : {}),
  };
}

/** The list fields across all types, as `add` advertises them. */
function listProperties(): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(unionProperties()).filter(([, field]) => (field as { type?: string }).type === "array")
  );
}

export const updateTool: Tool = {
  definition: {
    name: "fyi_update",
    description:
      "Change fields on an existing item. Only the fields given are touched. Set archived:true to archive an item — nothing is ever deleted.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        synced: {
          type: "boolean",
          description:
            "Set when these values came from re-reading the source of truth, not from local reasoning. Stamps synced_at, which is what clears a staleness warning. On its own, it confirms an item that has not changed, and leaves updated_at alone.",
        },
        add: {
          type: "object",
          description:
            "Entries to append to list fields, by field: {attention_items: [{type, description}]}. Exact duplicates are skipped. Prefer this to setting the whole list, which loses entries other sessions wrote.",
          properties: listProperties(),
        },
        remove: {
          type: "object",
          description:
            "Entries to drop from list fields, by field. An object drops every entry whose named fields match — {attention_items: {type: \"review\"}}; a value drops entries equal to it — {tags: \"stale\"}. Applied before add, so the two together replace an entry.",
          properties: Object.fromEntries(Object.keys(listProperties()).map((name) => [name, {}])),
        },
        ...unionProperties(),
      },
      required: ["id"],
    },
  },
  handler,
};
