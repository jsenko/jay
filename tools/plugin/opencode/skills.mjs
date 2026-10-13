/**
 * A plugin's skills, renamed for opencode.
 *
 * opencode reads a skill's name from its `SKILL.md` on disk, so renaming
 * one takes a copy: `SKILL.md` rewritten (name, plugin root, command
 * references), every other file a link to the original. The copies live in
 * `~/.local/share/jay/<plugin>/opencode-skills/`, whose path is returned
 * for `skills.paths`.
 */

import { mkdir, readFile, readdir, rename, rm, symlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import { opencodeName, toOpencodeRefs } from "./names.mjs";

/** Where a plugin's renamed skills are written. */
export function skillsDir(plugin) {
  return join(homedir(), ".local", "share", "jay", plugin, "opencode-skills");
}

/** The `SKILL.md` text for opencode: its name, the plugin root and references rewritten. */
function rewrite(text, name, substitute) {
  return toOpencodeRefs(substitute(text)).replace(/^name:.*$/m, `name: ${name}`);
}

/** The file's text, or undefined when it doesn't exist. */
async function readIfThere(path) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return undefined;
  }
}

/**
 * Writes one skill's copy, unless the existing one is already current.
 * Built in a temporary folder and renamed into place, so a session never
 * reads half a copy; when two sessions race, one rename wins and the other
 * is dropped.
 */
async function writeSkill(source, target, text) {
  if ((await readIfThere(join(target, "SKILL.md"))) === text) return;

  const temp = `${target}.${process.pid}`;
  await rm(temp, { recursive: true, force: true });
  await mkdir(temp, { recursive: true });
  for (const file of await readdir(source)) {
    if (file !== "SKILL.md") await symlink(join(source, file), join(temp, file));
  }
  await writeFile(join(temp, "SKILL.md"), text);

  await rm(target, { recursive: true, force: true });
  try {
    await rename(temp, target);
  } catch {
    await rm(temp, { recursive: true, force: true });
  }
}

/** Writes every skill of the plugin at `root`, and returns the folder holding them, or undefined if it has none. */
export async function writeSkills(root, plugin, substitute) {
  let skills;
  try {
    skills = await readdir(join(root, "skills"));
  } catch (e) {
    if (e.code === "ENOENT") return undefined;
    throw e;
  }
  const dir = skillsDir(plugin);
  await mkdir(dir, { recursive: true });
  for (const skill of skills) {
    const source = join(root, "skills", skill);
    const text = await readIfThere(join(source, "SKILL.md"));
    if (text === undefined) continue;
    const name = opencodeName(plugin, skill);
    await writeSkill(source, join(dir, name), rewrite(text, name, substitute));
  }
  return dir;
}
