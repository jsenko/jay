/** Reading the front matter of a command or skill file. */

/**
 * Splits a Markdown file into its front matter and body. Only flat
 * `key: value` lines are read, which is all commands and skills use.
 */
export function parseMarkdown(text) {
  if (!text.startsWith("---\n")) return { meta: {}, body: text };
  const end = text.indexOf("\n---", 4);
  const meta = Object.fromEntries(
    text.slice(4, end).split("\n")
      .map((line) => line.match(/^([\w-]+):\s*(.*)$/))
      .filter(Boolean)
      .map(([, key, value]) => [key, value.replace(/^["']|["']$/g, "")]),
  );
  return { meta, body: text.slice(end + 4).replace(/^\n/, "") };
}
