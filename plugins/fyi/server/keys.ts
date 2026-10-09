/**
 * Natural keys for mirrored items.
 *
 * A mirrored item stands for something that already has an identity
 * outside the store — a pull request has a URL. Naming the item after
 * that identity, rather than after its title, is what lets an event be
 * matched to its item without a search, and what stops the same PR being
 * captured twice under two titles.
 *
 * The key field is declared in the schema (`x-fyi-key`), so a new
 * mirrored type gets this by naming its field rather than by new code.
 */

import { ToolError } from "./errors.js";
import { SCHEMAS } from "./schema.js";
import { all } from "./store.js";
import type { Item, ItemType, StoredItem } from "./types.js";

/** The parts of a forge URL that an id and the derived fields are built from. */
export interface KeyParts {
  host: string;
  owner: string;
  repo: string;
  number: number;
  /** The URL in canonical form: lowercase host, owner and repo, nothing trailing. */
  canonical: string;
}

/**
 * `https://<host>/<owner>/<repo>/<kind>/<number>`, as GitHub and GitHub
 * Enterprise write pull request and issue URLs.
 */
const FORGE_URL = /^https?:\/\/([^/\s]+)\/([^/\s]+)\/([^/\s]+)\/([a-z_-]+)\/(\d+)\/?(?:[?#].*)?$/i;

/** Fields filled in from a key URL, when the type's schema has them. */
export const DERIVED_FIELDS = ["repo", "number"] as const;

/** The key field for a type, or undefined when the type is authored. */
export function keyField(type: ItemType): string | undefined {
  return SCHEMAS[type].key;
}

/** Splits a key URL into its parts, or explains why it cannot. */
export function parseKey(url: unknown): KeyParts {
  const match = typeof url === "string" ? FORGE_URL.exec(url.trim()) : null;
  if (!match) {
    throw new ToolError(
      `url must be a link to the item itself, like https://github.com/Owner/Repo/pull/123 — got ${JSON.stringify(url)}`
    );
  }
  const [, host, owner, repo, kind, number] = match;
  return {
    host: host.toLowerCase(),
    owner,
    repo,
    number: Number(number),
    canonical: `https://${host}/${owner}/${repo}/${kind}/${number}`.toLowerCase(),
  };
}

/**
 * Fills in `repo` and `number` from the key URL, and refuses values that
 * disagree with it.
 *
 * They are kept as fields because processes and the dashboard read them,
 * but the URL is the one source, so they cannot drift from it.
 */
export function deriveFromKey(type: ItemType, fields: Record<string, unknown>): KeyParts {
  const field = keyField(type)!;
  const parts = parseKey(fields[field]);
  const props = SCHEMAS[type].properties;

  const values = { repo: `${parts.owner}/${parts.repo}`, number: parts.number };
  const derived = Object.fromEntries(DERIVED_FIELDS.filter((name) => props[name]).map((name) => [name, values[name]]));

  for (const [name, value] of Object.entries(derived)) {
    const given = fields[name];
    if (given !== undefined && String(given).toLowerCase() !== String(value).toLowerCase()) {
      throw new ToolError(`${name} is ${JSON.stringify(given)} but ${field} says ${JSON.stringify(value)}; leave ${name} out and it is derived`);
    }
    fields[name] = value;
  }
  return parts;
}

/** The item, active or archived, whose key matches — whatever its id. */
export function findByKey(type: ItemType, parts: KeyParts): StoredItem | undefined {
  return all(true).find((stored) => stored.item.type === type && sameKey(stored.item, parts));
}

/** Lowercase and hyphenated, for use inside an id. */
function part(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/**
 * Ids for a keyed item, shortest first.
 *
 * The repository name alone is enough almost always; the owner, then the
 * host, are added only when a shorter form is taken by a different item.
 * Duplicates are caught by key, not by id, so the short form is safe.
 */
export function keyIdCandidates(type: ItemType, parts: KeyParts): string[] {
  const { host, owner, repo, number } = parts;
  return [
    `${type}-${part(repo)}-${number}`,
    `${type}-${part(owner)}-${part(repo)}-${number}`,
    `${type}-${part(host)}-${part(owner)}-${part(repo)}-${number}`,
  ];
}

/** Whether an item's key matches the given parts. */
export function sameKey(item: Item, parts: KeyParts): boolean {
  const field = keyField(item.type);
  if (!field) return false;
  try {
    return parseKey(item[field]).canonical === parts.canonical;
  } catch {
    return false;
  }
}
