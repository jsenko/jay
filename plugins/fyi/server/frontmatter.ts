/**
 * Markdown with YAML frontmatter: the on-disk form of an item.
 *
 * Schema fields live in the frontmatter, where tools query them. The one
 * long prose field per type becomes the markdown body, where it stays
 * comfortable to read and edit by hand.
 */

import { parse, stringify } from "yaml";

import { BODY_FIELD, type Item, type ItemType } from "./types.js";

const DELIMITER = "---";

/** Splits a file into its frontmatter object and body text. */
export function parseFile(text: string): { fields: Record<string, unknown>; body: string } {
  if (!text.startsWith(DELIMITER)) return { fields: {}, body: text.trim() };

  const end = text.indexOf(`\n${DELIMITER}`, DELIMITER.length);
  if (end === -1) return { fields: {}, body: text.trim() };

  const yaml = text.slice(DELIMITER.length, end);
  const body = text.slice(end + DELIMITER.length + 1).trim();
  return { fields: (parse(yaml) as Record<string, unknown>) ?? {}, body };
}

/** Reconstructs an item from a file's contents. */
export function toItem(text: string, type: ItemType): Item {
  const { fields, body } = parseFile(text);
  const item = { ...fields } as Item;
  if (body) item[BODY_FIELD[type]] = body;
  return item;
}

/** Renders an item as frontmatter plus body. */
export function toFile(item: Item): string {
  const bodyField = BODY_FIELD[item.type];
  const { [bodyField]: body, ...fields } = item;

  const ordered = orderFields(fields as Record<string, unknown>);
  const yaml = stringify(ordered, { lineWidth: 0 }).trimEnd();
  const text = typeof body === "string" ? body.trim() : "";

  return `${DELIMITER}\n${yaml}\n${DELIMITER}\n${text ? `\n${text}\n` : ""}`;
}

/** Identity fields first, so a file opens on something recognisable. */
const FIELD_ORDER = ["id", "type", "title", "status", "created_at", "updated_at"];

function orderFields(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const name of FIELD_ORDER) {
    if (fields[name] !== undefined) out[name] = fields[name];
  }
  for (const [name, value] of Object.entries(fields)) {
    if (value !== undefined && out[name] === undefined) out[name] = value;
  }
  return out;
}
