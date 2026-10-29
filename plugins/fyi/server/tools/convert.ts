/** `fyi_convert` — change an item's type, carrying its context. */

import { ToolError } from "../errors.js";
import { authoredId, keyedId } from "../identity.js";
import { deriveFromKey, findByKey, keyField } from "../keys.js";
import { stampCompletion } from "../completion.js";
import { checkRefs } from "../refs.js";
import { addLink, inverseOf } from "../links.js";
import { SCHEMAS, unionProperties, validate, type FieldSchema } from "../schema.js";
import { get, write } from "../store.js";
import { nowIso } from "../time.js";
import { BODY_FIELD, ITEM_TYPES, type Item, type ItemType, type Link } from "../types.js";
import { requireString } from "../validation.js";
import type { Tool } from "./tool.js";

/** Fields the server owns, which never carry across a conversion. Links are carried separately. */
const NOT_CARRIED = new Set(["id", "type", "created_at", "updated_at", "links", "archived"]);

/**
 * Whether a field holds something written by hand, worth keeping in the
 * body when the target type has no place for it. Enums, dates, flags and
 * numbers are state that means nothing under another type.
 */
function isProse(field: FieldSchema | undefined): boolean {
  const scalar = field?.type === "array" ? field.items : field;
  return scalar?.type === "string" && !scalar.enum && !scalar.format;
}

/**
 * Moves the links other items hold to the source over to the converted
 * item, or adds them alongside when the source stays active, so each
 * carried link still reads from both ends.
 */
function carryInverses(links: Link[], sourceId: string, newId: string, keepSource: boolean, now: string): void {
  for (const link of links) {
    const inverse = inverseOf(link.rel);
    const other = inverse ? get(link.id) : undefined;
    if (!inverse || !other) continue;

    const held = other.item.links ?? [];
    const old = held.find((l) => l.id === sourceId && l.rel === inverse);
    const kept = keepSource ? held : held.filter((l) => l !== old);
    other.item.links = addLink(kept, { id: newId, rel: inverse, note: old?.note ?? link.note });
    other.item.updated_at = now;
    write(other.item, other.scope);
  }
}

/**
 * Converts an item to another type.
 *
 * The same move shows up in several places — a note that turns out to
 * need doing, a task too big to be one task, an expired crew job — so it
 * is one mechanism rather than a special case each time. Provenance is
 * always written: "why does this exist?" has to stay answerable for
 * items created while nobody was watching.
 */
function handler(args: Record<string, any>) {
  const { id: rawId, to, keep_source, ...extra } = args;
  const id = requireString(rawId, "id");

  if (!ITEM_TYPES.includes(to)) {
    throw new ToolError(`to must be one of: ${ITEM_TYPES.join(", ")}`);
  }

  const stored = get(id);
  if (!stored) throw new ToolError(`no item with id "${id}"`);

  const source = stored.item;
  const target = to as ItemType;
  if (source.type === target) throw new ToolError(`"${id}" is already a ${target}`);

  const carried: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(source)) {
    if (!NOT_CARRIED.has(field) && value !== undefined) carried[field] = value;
  }

  // The long prose field is named differently per type, so move it
  // across rather than dropping it on the floor.
  const sourceBody = BODY_FIELD[source.type];
  const targetBody = BODY_FIELD[target];
  if (sourceBody !== targetBody && carried[sourceBody] !== undefined) {
    carried[targetBody] = carried[sourceBody];
    delete carried[sourceBody];
  }

  for (const key of Object.keys(extra)) {
    if (extra[key] === undefined) delete extra[key];
  }
  const fields = { ...carried, ...extra };

  // Drop anything the target type has no place for, rather than failing:
  // a conversion should not require the caller to know both schemas.
  // What was written by hand goes into the body instead, so nothing the
  // user wrote is lost.
  const folded = new Map<string, string>();
  for (const field of Object.keys(fields)) {
    try {
      validate(target, { [field]: fields[field] }, { partial: true });
    } catch {
      if (!(field in SCHEMAS[target].properties) && isProse(SCHEMAS[source.type].properties[field])) {
        const value = fields[field];
        folded.set(field, `${field}: ${Array.isArray(value) ? value.join(", ") : value}`);
      }
      delete fields[field];
    }
  }
  if (folded.size > 0) {
    fields[targetBody] = [fields[targetBody], [...folded.values()].join("\n")].filter(Boolean).join("\n\n");
  }

  // Only the fields the caller added are checked: a reference carried
  // over from the source was valid when it was written.
  checkRefs(target, extra);

  let newId: string;
  if (keyField(target)) {
    const parts = deriveFromKey(target, fields);
    const existing = findByKey(target, parts);
    if (existing) throw new ToolError(`already tracked as "${existing.item.id}"`);
    newId = keyedId(target, parts);
  } else {
    newId = authoredId(target, String(fields.title ?? source.title));
  }

  validate(target, { ...fields, id: "placeholder", type: target });

  const now = nowIso();
  const item: Item = {
    ...fields,
    id: newId,
    type: target,
    title: String(fields.title ?? source.title),
    created_at: now,
    updated_at: now,
    links: addLink(source.links, { id, rel: "from", note: `converted from ${source.type}` }),
  } as Item;
  // A carried completed_at is the source's finish time, which still holds.
  stampCompletion(item, undefined, fields, now);

  write(item, stored.scope);
  carryInverses(source.links ?? [], id, item.id, Boolean(keep_source), now);

  if (!keep_source) {
    source.archived = true;
    source.updated_at = now;
  }
  source.links = addLink(source.links, {
    id: item.id,
    rel: "relates-to",
    note: `converted to ${target}`,
  });
  write(source, stored.scope);

  return {
    id: item.id,
    type: target,
    from: id,
    source_archived: !keep_source,
    dropped: Object.keys(carried).filter((f) => fields[f] === undefined && !folded.has(f)),
    folded: [...folded.keys()],
  };
}

export const convertTool: Tool = {
  definition: {
    name: "fyi_convert",
    description:
      "Turn one item into another type, carrying its content and links and recording where it came from: a note that turns out to need doing, a task that is really a project, a project that was only ever one task. Text the new type has no field for, such as a note's urls on a task, is added to the body. The original is archived unless keep_source is set.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The item to convert." },
        to: { type: "string", enum: [...ITEM_TYPES] },
        keep_source: {
          type: "boolean",
          description: "Leave the original active instead of archiving it.",
        },
        ...unionProperties(),
      },
      required: ["id", "to"],
    },
  },
  handler,
};
