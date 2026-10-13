/**
 * Whether polling works, per source, so a session can tell "nothing
 * happened" from "polling is broken" (`get_status`).
 */

/** The three things the poller polls. */
export type PollSource = "repo_events" | "workflow_runs" | "notifications";

/** One failed poll. */
export interface HealthError {
  timestamp: string;
  source: PollSource;
  message: string;
}

/** The last success and the last failure of one source. */
export interface SourceHealth {
  lastSuccessAt: string | null;
  lastError: HealthError | null;
}

/** What `get_status` reports. */
export interface PollerStatus {
  authenticatedUser: string;
  monitoredRepos: string[];
  pollIntervalSeconds: number;
  /** Whether this server polls; it starts on the first `get_status` or `get_new_events`. */
  polling: boolean;
  sources: Record<PollSource, SourceHealth>;
  recentErrors: HealthError[];
  coverage: {
    serverStartedAt: string | null;
    oldestBufferedEvent: string | null;
    bufferedEventCount: number;
  };
}

/** How many recent errors are kept for `get_status`. */
const MAX_RECENT_ERRORS = 20;

/** Successes and failures of each source, as they happen. */
export class Health {
  readonly sources: Record<PollSource, SourceHealth> = {
    repo_events: { lastSuccessAt: null, lastError: null },
    workflow_runs: { lastSuccessAt: null, lastError: null },
    notifications: { lastSuccessAt: null, lastError: null },
  };
  readonly recentErrors: HealthError[] = [];

  /** Records a failure, keeping only the most recent ones. */
  error(source: PollSource, message: string): void {
    const entry: HealthError = { timestamp: new Date().toISOString(), source, message };
    this.sources[source].lastError = entry;
    this.recentErrors.push(entry);
    if (this.recentErrors.length > MAX_RECENT_ERRORS) {
      this.recentErrors.shift();
    }
  }

  /** Records a successful poll. */
  success(source: PollSource): void {
    this.sources[source].lastSuccessAt = new Date().toISOString();
  }
}
