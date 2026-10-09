/** Relationships between items. */

import type { Link } from "./types.js";

type Rel = Link["rel"];

/**
 * The matching relationship written on the other item.
 *
 * `from` records provenance and has no inverse: knowing a task came from
 * an expired job is useful, but the job does not gain anything by
 * pointing forward.
 */
const INVERSE: Partial<Record<Rel, Rel>> = {
  parent: "child",
  child: "parent",
  blocks: "blocked-by",
  "blocked-by": "blocks",
  "relates-to": "relates-to",
};

/** The inverse of a relationship, or null when it is one-directional. */
export function inverseOf(rel: Rel): Rel | null {
  return INVERSE[rel] ?? null;
}

/** Adds a link, replacing any existing link to the same item. */
export function addLink(links: Link[] | undefined, link: Link): Link[] {
  const kept = (links ?? []).filter((l) => !(l.id === link.id && l.rel === link.rel));
  return [...kept, link];
}
