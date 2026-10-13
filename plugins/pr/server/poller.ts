/**
 * The poll loop: repository events, workflow runs and notifications, on
 * an interval, with the cursor saved after each round.
 */

import type { Cache } from "./cache.js";
import type { PollerConfig } from "./config.js";
import type { EventCallback, PollContext } from "./context.js";
import { API, githubHeaders } from "./github.js";
import { Health, type PollerStatus } from "./health.js";
import { pollNotifications } from "./notifications.js";
import { pollRepoEvents, processEvents } from "./repo-events.js";
import { resolveRepos } from "./repos.js";
import { loadState, saveState, type StateFile } from "./state.js";
import { pollWorkflowRuns } from "./workflow-runs.js";

/** How often `owner/*` patterns are resolved again, for new repositories. */
const REPO_REFRESH_INTERVAL = 3600_000;

/** Polls GitHub until stopped, reporting each new event through `onEvent`. */
export class Poller {
  private config: PollerConfig;
  private cache: Cache;
  private state: StateFile;
  private onEvent: EventCallback;
  private running = false;
  private resolvedRepos: string[] = [];
  private lastRepoRefresh = 0;
  private authenticatedUser = "";
  private health = new Health();
  private startedAt: string | null = null;

  constructor(config: PollerConfig, cache: Cache, onEvent: EventCallback) {
    this.config = config;
    this.cache = cache;
    this.state = loadState(config.stateFilePath);
    this.onEvent = onEvent;
  }

  /** Health and coverage, for `get_status`. */
  getStatus(): PollerStatus {
    return {
      authenticatedUser: this.authenticatedUser,
      monitoredRepos: [...this.resolvedRepos],
      pollIntervalSeconds: this.config.pollInterval || 60,
      sources: structuredClone(this.health.sources),
      recentErrors: [...this.health.recentErrors],
      coverage: {
        serverStartedAt: this.startedAt,
        oldestBufferedEvent: this.cache.getOldestEventTimestamp(),
        bufferedEventCount: this.cache.getEventCount(),
      },
    };
  }

  /** What the sources poll with. Built per round, so it carries the current repos and user. */
  private context(): PollContext {
    return {
      config: this.config,
      cache: this.cache,
      state: this.state,
      health: this.health,
      onEvent: this.onEvent,
      repos: this.resolvedRepos,
      user: this.authenticatedUser,
    };
  }

  /** Resolves the repository patterns, at most once an hour once they have resolved. */
  private async refreshRepos(): Promise<void> {
    if (Date.now() - this.lastRepoRefresh < REPO_REFRESH_INTERVAL && this.resolvedRepos.length > 0) {
      return;
    }
    this.resolvedRepos = await resolveRepos(this.config.repos, this.config.githubToken);
    this.lastRepoRefresh = Date.now();
  }

  /** Who the token belongs to, so mentions of them pass the filters. */
  private async fetchAuthenticatedUser(): Promise<string> {
    const res = await fetch(`${API}/user`, {
      headers: githubHeaders(this.config.githubToken),
    });
    if (!res.ok) {
      console.error(`[github-events] Failed to fetch authenticated user: ${res.status}`);
      return "";
    }
    const data: any = await res.json();
    return data.login;
  }

  /** Runs the loop until `stop`. */
  async start(): Promise<void> {
    this.running = true;
    this.startedAt = new Date().toISOString();

    this.authenticatedUser = await this.fetchAuthenticatedUser();
    if (this.authenticatedUser) {
      console.error(`[github-events] Authenticated as: ${this.authenticatedUser}`);
    } else {
      console.error("[github-events] Warning: could not determine authenticated user — mention bypass and PR author filtering will be disabled");
    }

    await this.refreshRepos();

    const isFirstRun = this.resolvedRepos.every((r) => !this.state.repos[r]);
    if (isFirstRun) {
      console.error("[github-events] First run — loading existing events into state.");
    }
    console.error(`[github-events] Monitoring ${this.resolvedRepos.length} repo(s): ${this.resolvedRepos.join(", ")}`);
    console.error(`[github-events] Max event age: ${this.config.maxEventAgeHours}h`);
    console.error(`[github-events] State file: ${this.config.stateFilePath}`);

    let interval = this.config.pollInterval || 60;

    while (this.running) {
      try {
        interval = await this.pollOnce();
      } catch (err) {
        console.error("[github-events] Poll error:", err);
      }
      await new Promise((resolve) => setTimeout(resolve, interval * 1000));
    }
  }

  /** Ends the loop after the current round. */
  stop(): void {
    this.running = false;
  }

  /**
   * One round over every source, then the cursor saved. Returns the seconds
   * to wait: the configured interval, or GitHub's `X-Poll-Interval` when
   * none is configured and it asks for longer.
   */
  private async pollOnce(): Promise<number> {
    await this.refreshRepos();
    let maxPollInterval = this.config.pollInterval || 60;

    let repoEventsHadError = false;

    for (const repo of this.resolvedRepos) {
      const repoState = this.state.repos[repo];
      const isFirstRun = !repoState;

      const { events, etag, pollInterval, error } = await pollRepoEvents(
        repo,
        repoState?.lastPollEtag ?? null,
        this.config.githubToken
      );

      if (error) {
        this.health.error("repo_events", error);
        repoEventsHadError = true;
      }

      if (pollInterval && !this.config.pollInterval) {
        maxPollInterval = Math.max(maxPollInterval, pollInterval);
      }

      if (events.length === 0 && etag) {
        if (repoState) {
          repoState.lastPollEtag = etag;
          repoState.lastPollAt = new Date().toISOString();
        }
        continue;
      }

      const { newEvents, latestEventId } = await processEvents(
        events, repoState, isFirstRun, this.config, this.cache, this.authenticatedUser
      );

      for (const { id, event: newEvent } of newEvents) {
        this.onEvent(id, newEvent);
      }

      if (latestEventId) {
        this.state.repos[repo] = {
          lastEventId: latestEventId,
          lastPollEtag: etag ?? repoState?.lastPollEtag ?? "",
          lastPollAt: new Date().toISOString(),
        };
      }
    }

    if (!repoEventsHadError) {
      this.health.success("repo_events");
    }

    await pollWorkflowRuns(this.context());
    await pollNotifications(this.context());

    saveState(this.config.stateFilePath, this.state);
    return maxPollInterval;
  }
}
