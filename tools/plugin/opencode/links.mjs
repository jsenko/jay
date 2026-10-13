/** The `~/.jay/plugins/<name>` link, which the Claude Code `SessionStart` hook makes there. */

import { mkdir, readlink, rename, symlink } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Points `~/.jay/plugins/<name>` at `root`, through a temporary link
 * renamed into place, so sessions starting together never see it missing.
 */
export async function link(root, name) {
  const links = join(homedir(), ".jay", "plugins");
  const target = join(links, name);
  try {
    if ((await readlink(target)) === root) return;
  } catch {
    // Missing, or not a link yet.
  }
  await mkdir(links, { recursive: true });
  const temp = join(links, `.${name}.${process.pid}`);
  await symlink(root, temp);
  await rename(temp, target);
}
