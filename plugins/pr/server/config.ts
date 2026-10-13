/** The poller's configuration: token, repositories, timing and where state lives. */

import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { resolve } from "node:path";

import { gitHubSettings } from "./settings.js";

/** Everything the poller is told before it starts. */
export interface PollerConfig {
  githubToken: string;
  /** `owner/repo` or `owner/*` patterns, resolved at start and hourly. */
  repos: string[];
  /** Seconds between polls; 0 lets GitHub's `X-Poll-Interval` decide. */
  pollInterval: number;
  /** Events older than this are never delivered. */
  maxEventAgeHours: number;
  stateFilePath: string;
}

/**
 * A token from the GitHub CLI's keyring.
 *
 * `GH_HOST` is forced to github.com: with an Enterprise host configured,
 * a bare `gh auth token` returns that host's token and every API call
 * 404s against the public API.
 */
function tokenFromGhCli(): string {
  try {
    return execFileSync("gh", ["auth", "token"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      env: { ...process.env, GH_HOST: "github.com" },
    }).trim();
  } catch {
    return "";
  }
}

/**
 * Reads the configuration. The environment wins over the settings file,
 * so tests and one-off runs need no file.
 */
export function loadConfig(): PollerConfig {
  // Falling back to the CLI keeps the token out of the client's config,
  // and a rotated token needs no reinstall.
  const githubToken =
    process.env.GITHUB_TOKEN || process.env.GH_TOKEN || tokenFromGhCli();
  const repos = process.env.GITHUB_REPOS
    ? process.env.GITHUB_REPOS.split(",").map((r) => r.trim()).filter(Boolean)
    : gitHubSettings().repos ?? [];
  const pollInterval = parseInt(process.env.POLL_INTERVAL ?? "180", 10);
  const maxEventAgeHours = parseInt(process.env.MAX_EVENT_AGE ?? "24", 10);
  const stateFilePath = resolve(
    process.env.STATE_FILE ?? `${homedir()}/.jay/pr/state.json`
  );
  return { githubToken, repos, pollInterval, maxEventAgeHours, stateFilePath };
}

/** Throws the first problem that would leave the server watching nothing. */
export function validateConfig(config: PollerConfig): void {
  if (!config.githubToken) {
    throw new Error("GITHUB_TOKEN or GH_TOKEN is required");
  }
  if (config.repos.length === 0) {
    throw new Error("no repositories to watch: set github.repos in ~/.jay/config.json (run the pr plugin's setup.sh), or GITHUB_REPOS");
  }
  for (const repo of config.repos) {
    if (!repo.match(/^[^/]+\/(\*|[^/]+)$/)) {
      throw new Error(`Invalid repo format: "${repo}". Expected "owner/repo" or "owner/*".`);
    }
  }
}
