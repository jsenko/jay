/**
 * Registers a Claude Code plugin folder with opencode, through opencode's
 * plugin `config` hook, so each plugin keeps one source in Claude Code's
 * layout. Each plugin's `opencode.mjs` calls `jayPlugin` with its root.
 */

import { homedir } from "node:os";
import { join } from "node:path";

import { loadCommands } from "./commands.mjs";
import { link } from "./links.mjs";
import { loadMcp, readJson } from "./mcp.mjs";
import { allowDirectories } from "./permissions.mjs";
import { writeSkills } from "./skills.mjs";

const ROOT_VAR = /\$\{CLAUDE_PLUGIN_ROOT\}/g;
const DATA_VAR = /\$\{CLAUDE_PLUGIN_DATA\}/g;

/**
 * Adds the plugin at `root` to an opencode config: its commands, MCP
 * servers and skills, the directories its sessions use, and the
 * `~/.jay/plugins/<name>` link instruction files read through.
 */
export async function register(root, config) {
  const manifest = await readJson(join(root, ".claude-plugin", "plugin.json"));
  const plugin = manifest.name;
  const data = join(homedir(), ".local", "share", "jay", plugin);
  const substitute = (s) => s.replace(ROOT_VAR, root).replace(DATA_VAR, data);

  config.command = { ...config.command, ...(await loadCommands(root, plugin, substitute)) };
  config.mcp = { ...config.mcp, ...(await loadMcp(root, substitute)) };
  const skills = await writeSkills(root, plugin, substitute);
  if (skills) config.skills = { ...config.skills, paths: [...(config.skills?.paths ?? []), skills] };
  config.permission = allowDirectories(config.permission, plugin);
  await link(root, plugin);
}

/** The opencode plugin for the Claude Code plugin at `root`. */
export function jayPlugin(root) {
  return async () => ({ config: (config) => register(root, config) });
}
