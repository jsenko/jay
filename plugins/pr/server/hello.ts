/**
 * The hello: one push after the session's first tool call, so the session
 * learns that pushes reach it and can stop polling.
 *
 * Claude Code never declares the `claude/channel` capability, so the
 * server can't tell whether its pushes arrive. A session that receives
 * the hello knows they do; one that doesn't keeps polling
 * `get_new_events`, which is always safe. The same as crew's hello.
 */

/** Lets the first tool call's answer reach the session before the hello does. */
const GREET_DELAY_MS = 200;

/** What the hello says. */
export const HELLO = JSON.stringify({ github: "hello" });

/** Whether the hello has gone out. */
let greeted = false;

/** Sends the hello through `push`, the first time only. */
export function greetOnce(push: (content: string) => void): void {
  if (greeted) return;
  greeted = true;
  setTimeout(() => push(HELLO), GREET_DELAY_MS).unref();
}
