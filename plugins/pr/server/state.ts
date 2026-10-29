/**
 * What the poller has already seen, kept on disk so a restart neither
 * repeats events nor loses those that arrived while it was down.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** The cursor into one repository's event stream. */
export interface RepoState {
  lastEventId: string;
  lastPollEtag: string;
  lastPollAt: string;
}

/** The cursor into one repository's workflow runs. */
export interface WorkflowRunState {
  lastRunId: number;
  lastPollAt: string;
}

/** One repository's open PRs and their heads, to notice pushes. */
export interface PullHeadsState {
  /** The first page's ETag; a 304 means no PR changed. */
  etag: string | null;
  /** Head SHA by PR number. */
  heads: Record<string, string>;
}

/** Everything persisted between runs. */
export interface StateFile {
  repos: Record<string, RepoState>;
  pullHeads?: Record<string, PullHeadsState>;
  workflowRuns?: Record<string, WorkflowRunState>;
  lastNotificationAt?: string;
  /**
   * The notifications updated at exactly `lastNotificationAt`. GitHub's
   * `since` includes that instant, so they come back on the next poll.
   */
  notificationsAtCursor?: string[];
}

/** The saved state, or a fresh one when there is none or it is unreadable. */
export function loadState(path: string): StateFile {
  if (!existsSync(path)) {
    return { repos: {} };
  }
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return { repos: {} };
  }
}

/** Writes the state, creating its directory on first use. */
export function saveState(path: string, state: StateFile): void {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, JSON.stringify(state, null, 2) + "\n");
}
