/** Item shape shared by the store, the schemas and the tools. */

/** The item types this server knows. Extended by adding a schema file. */
export const ITEM_TYPES = ["task", "note", "project", "pr"] as const;

export type ItemType = (typeof ITEM_TYPES)[number];

/**
 * A storage scope, kept apart so personal items stay separable: a directory
 * under the store's root (`scopes.ts`). Items go to the default scope unless
 * a call names another.
 */
export type Scope = string;

/** A structured relationship between two items. */
export interface Link {
  id: string;
  rel: "parent" | "child" | "blocks" | "blocked-by" | "relates-to" | "from";
  note?: string;
}

/**
 * A stored item.
 *
 * Common fields are declared; type-specific ones are validated against
 * the type's schema rather than the TypeScript type, since the schemas
 * are the source of truth.
 */
export interface Item {
  id: string;
  type: ItemType;
  title: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
  archived?: boolean;
  links?: Link[];
  [field: string]: unknown;
}

/**
 * The one long prose field per type, stored as the markdown body rather
 * than as frontmatter so it stays comfortable to edit by hand.
 */
export const BODY_FIELD: Record<ItemType, string> = {
  task: "description",
  note: "content",
  project: "description",
  pr: "summary",
};

/** An item together with where it came from. */
export interface StoredItem {
  item: Item;
  scope: Scope;
  path: string;
}
