/** A plugin's commands, as opencode registers them. */

import { readFile, readdir } from "node:fs/promises";
import { basename, join } from "node:path";

import { parseMarkdown } from "./markdown.mjs";
import { opencodeName, toOpencodeRefs } from "./names.mjs";

/** Each `commands/*.md` under its opencode name, with references rewritten. */
export async function loadCommands(root, plugin, substitute) {
  let files;
  try {
    files = (await readdir(join(root, "commands"))).filter((f) => f.endsWith(".md"));
  } catch (e) {
    if (e.code === "ENOENT") return {};
    throw e;
  }
  const commands = {};
  for (const file of files.sort()) {
    const { meta, body } = parseMarkdown(await readFile(join(root, "commands", file), "utf8"));
    commands[opencodeName(plugin, basename(file, ".md"))] = {
      template: toOpencodeRefs(substitute(body)),
      ...(meta.description && { description: meta.description }),
    };
  }
  return commands;
}
