/**
 * Whose move an attention item is.
 *
 * Items say so in `who`. Ones written before that field existed fall
 * back to what their type usually means, so an old PR still splits into
 * "for you" and "waiting on someone else" instead of looking urgent.
 */

/** Who acts on an attention item. */
export type Who = "user" | "author" | "maintainer" | "automation";

/** What an item of each type usually waits on, when it does not say. */
const BY_TYPE: Record<string, Who> = {
  review: "automation",
  "re-review": "automation",
  "ci-investigate": "automation",
  respond: "user",
  decide: "user",
  merge: "user",
  "ci-approve": "user",
  "manual-review": "user",
  "ci-failing": "author",
  stale: "author",
  assign: "maintainer",
};

/** One attention item, as written on a `pr`. */
export interface AttentionItem {
  type: string;
  description: string;
  who?: Who;
}

/** The item with `who` filled in, from the item itself when it says. */
export function withWho(item: AttentionItem): AttentionItem & { who: Who } {
  return { ...item, who: item.who ?? BY_TYPE[item.type] ?? "user" };
}
