/**
 * The user's GitHub settings, from `~/.jay/config.json`.
 *
 * That file holds settings several jay plugins share, written by the
 * plugins' setup scripts. pr reads its `github` section: who the user is
 * and which repositories to watch. `JAY_CONFIG` points elsewhere, for
 * tests.
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** The `github` section of `~/.jay/config.json`. */
export interface GitHubSettings {
  /** The user's GitHub handle. */
  user?: string;
  /** Repositories to watch, as `owner/repo` or `owner/*`. */
  repos?: string[];
}

/** Where the shared settings live. */
export const JAY_CONFIG = process.env.JAY_CONFIG || join(homedir(), ".jay", "config.json");

/**
 * The `github` section, or nothing when the file or section is missing.
 * A file that isn't valid JSON is an error: guessing past it would watch
 * the wrong repositories without saying so.
 */
export function gitHubSettings(path = JAY_CONFIG): GitHubSettings {
  if (!existsSync(path)) return {};
  const config = JSON.parse(readFileSync(path, "utf8"));
  return config.github ?? {};
}
