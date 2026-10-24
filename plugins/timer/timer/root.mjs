/**
 * The session a timer belongs to. A subagent runs in a child session,
 * which nobody sees once it finishes, so its timers go to the top-level
 * session it was started from (SPEC.md).
 */

/** Parent links followed at most, so a malformed chain can't loop. */
const MAX_DEPTH = 10;

/**
 * The top-level session above `session`, or `session` itself.
 * `parentOf` returns a session's parent id, or nothing for a top-level
 * one; a lookup that fails stops the walk where it is.
 */
export async function rootSession(session, parentOf) {
  let current = session;
  for (let depth = 0; depth < MAX_DEPTH; depth++) {
    let parent;
    try {
      parent = await parentOf(current);
    } catch {
      return current;
    }
    if (!parent) return current;
    current = parent;
  }
  return current;
}
