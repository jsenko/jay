/** Item id generation. */

import { ToolError } from "./errors.js";
import { keyIdCandidates, keyField, sameKey, type KeyParts } from "./keys.js";
import { get, exists } from "./store.js";
import type { ItemType } from "./types.js";

/** Longest slug after the type prefix. Long enough to read, short enough to type. */
const MAX_SLUG = 40;

/** An explicit slug: lowercase words joined by single hyphens. */
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Lowercase, hyphen-separated, safe in a filename, and cut at a word
 * boundary — `retry-on-sta` reads as a typo, `retry-on` does not.
 */
export function slug(text: string, max = MAX_SLUG): string {
  const full = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (full.length <= max) return full;

  const cut = full.slice(0, max + 1);
  const boundary = cut.lastIndexOf("-");
  // One very long word has no boundary to cut at; cut it mid-word.
  return boundary > 0 ? cut.slice(0, boundary) : full.slice(0, max);
}

/** The first free id from a base, adding `-2`, `-3`… on collision. */
function firstFree(base: string): string {
  if (!exists(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!exists(candidate)) return candidate;
  }
}

/**
 * The id for a keyed item: the shortest candidate not held by a
 * *different* item. Callers have already refused a duplicate key.
 */
export function keyedId(type: ItemType, parts: KeyParts): string {
  for (const candidate of keyIdCandidates(type, parts)) {
    const holder = get(candidate);
    if (!holder || sameKey(holder.item, parts)) return candidate;
  }
  return firstFree(keyIdCandidates(type, parts).at(-1)!);
}

/**
 * The id for an authored item: from an explicit slug when given, else
 * from the title.
 *
 * Type-prefixed so a filename says what it is, and so ids stay unique
 * across types without a registry. An explicit slug that is taken is an
 * error rather than a silent `-2`: the caller chose that name to type it.
 */
export function authoredId(type: ItemType, title: string, explicit?: unknown): string {
  if (keyField(type)) throw new ToolError(`a ${type} is named after its ${keyField(type)}; no slug needed`);

  if (explicit !== undefined) {
    if (typeof explicit !== "string" || !SLUG.test(explicit) || explicit.length > MAX_SLUG) {
      throw new ToolError(`slug must be lowercase words joined by hyphens, at most ${MAX_SLUG} characters`);
    }
    const id = `${type}-${explicit}`;
    if (exists(id)) throw new ToolError(`"${id}" is already taken`);
    return id;
  }

  return firstFree(`${type}-${slug(title) || "item"}`);
}
