/**
 * Dotted field paths, resolved through lists.
 *
 * `attention_items.type` on an item names the `type` of every entry in
 * its `attention_items` list. Both searching and reference checking need
 * that reading, so it lives once here.
 */

/** Splits `a.b.c` into its segments. */
export function segments(path: string): string[] {
  return path.split(".");
}

/**
 * Every value at a path, with lists flattened at each step.
 *
 * Absent values are left out, so a path that matches nothing returns an
 * empty list rather than `[undefined]`.
 */
export function valuesAt(value: unknown, path: string[]): unknown[] {
  if (Array.isArray(value)) return value.flatMap((entry) => valuesAt(entry, path));
  if (path.length === 0) return value === undefined ? [] : [value];
  if (typeof value !== "object" || value === null) return [];
  return valuesAt((value as Record<string, unknown>)[path[0]], path.slice(1));
}

/**
 * Replaces every value at a path that equals `from` with `to`, in place.
 * Returns how many were replaced.
 */
export function replaceAt(value: unknown, path: string[], from: unknown, to: unknown): number {
  if (Array.isArray(value)) {
    let count = 0;
    for (const [i, entry] of value.entries()) {
      if (path.length === 0) {
        if (entry === from) {
          value[i] = to;
          count++;
        }
      } else {
        count += replaceAt(entry, path, from, to);
      }
    }
    return count;
  }
  if (typeof value !== "object" || value === null || path.length === 0) return 0;

  const obj = value as Record<string, unknown>;
  const [head, ...rest] = path;
  if (rest.length === 0 && !Array.isArray(obj[head])) {
    if (obj[head] !== from) return 0;
    obj[head] = to;
    return 1;
  }
  return replaceAt(obj[head], rest, from, to);
}
