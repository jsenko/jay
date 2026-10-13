/**
 * What sessions may read and write outside the project without asking:
 * the same as `install.sh` grants in Claude Code.
 */

import { homedir } from "node:os";
import { join } from "node:path";

/** Extra directories a plugin's sessions work in, by plugin. */
function directoriesFor(plugin) {
  const dirs = [join(homedir(), ".jay", "**")];
  if (plugin === "fyi") {
    // A project's files, kept in fyi's project folders.
    dirs.push(join(process.env.FYI_DIR || join(homedir(), ".fyi"), "*", "projects", "**"));
  }
  return dirs;
}

/**
 * `permission` with the plugin's directories allowed. opencode applies the
 * last matching rule, so the grants go after whatever the user configured.
 */
export function allowDirectories(permission = {}, plugin) {
  const current = permission.external_directory;
  const rules = typeof current === "string" ? { "*": current } : { ...current };
  for (const dir of directoriesFor(plugin)) {
    // Re-added, not overwritten: an existing key keeps its place, and must be last.
    delete rules[dir];
    rules[dir] = "allow";
  }
  return { ...permission, external_directory: rules };
}
