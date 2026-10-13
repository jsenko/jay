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

/** Everything persisted between runs. */
export interface StateFile {
  repos: Record<string, RepoState>;
  workflowRuns?: Record<string, WorkflowRunState>;
  lastNotificationAt?: string;
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
