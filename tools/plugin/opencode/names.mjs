/**
 * Names in opencode. opencode namespaces neither commands nor skills, so
 * each gets its plugin's name as a prefix there: Claude Code's
 * `/crew:start` is `/crew-start`, and code's `style` skill is `code-style`.
 * The plugin files keep their own names.
 */

/** `<plugin>-<name>`, unless the name already starts with the plugin's. */
export function opencodeName(plugin, name) {
  return name === plugin || name.startsWith(`${plugin}-`) ? name : `${plugin}-${name}`;
}

/** Rewrites Claude Code references, `/crew:start`, into opencode's, `/crew-start`. */
export function toOpencodeRefs(text) {
  return text.replace(/\/([a-z][a-z0-9-]*):([a-z0-9-]+)/g, (_, plugin, name) => `/${opencodeName(plugin, name)}`);
}
