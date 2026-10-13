import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { execFileSync } from "child_process";
import { homedir } from "os";

import type {
  Event,
  Ref,
  NumberedRef,
  PullRequestEvent,
  PullRequestReviewEvent,
  PullRequestReviewCommentEvent,
  IssuesEvent,
  IssueCommentEvent,
  WorkflowRunEvent,
  NotificationEvent,
} from "./event-types.js";
import { Cache } from "./cache.js";
import { applyFilters } from "./filters.js";
import { gitHubSettings } from "./settings.js";

/** The GitHub API, overridable so tests can run against a fake. */
export const API = (process.env.GITHUB_API_URL || "https://api.github.com").replace(/\/$/, "");

// --- Types ---

interface RepoState {
  lastEventId: string;
  lastPollEtag: string;
  lastPollAt: string;
}

interface WorkflowRunState {
  lastRunId: number;
  lastPollAt: string;
}

interface StateFile {
  repos: Record<string, RepoState>;
  workflowRuns?: Record<string, WorkflowRunState>;
  lastNotificationAt?: string;
}

interface RawGitHubEvent {
  id: string;
  type: string;
  actor: { login: string; display_login?: string };
  repo: { name: string };
  payload: Record<string, any>;
  created_at: string;
}

// --- Configuration ---

export interface PollerConfig {
  githubToken: string;
  repos: string[];
  pollInterval: number;
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

export function loadConfig(): PollerConfig {
  // Falling back to the CLI keeps the token out of ~/.claude.json and
  // means a rotated token does not need a reinstall.
  const githubToken =
    process.env.GITHUB_TOKEN || process.env.GH_TOKEN || tokenFromGhCli();
  // The environment wins, so tests and one-off runs need no settings file.
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

function isWildcard(repo: string): boolean {
  return repo.endsWith("/*");
}

async function resolveOrgRepos(owner: string, token: string): Promise<string[]> {
  const repos: string[] = [];
  let page = 1;

  while (true) {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    // Try orgs endpoint first, fall back to users
    let url = `${API}/orgs/${owner}/repos?per_page=100&page=${page}`;
    let res = await fetch(url, { headers });

    if (res.status === 404) {
      url = `${API}/users/${owner}/repos?per_page=100&page=${page}`;
      res = await fetch(url, { headers });
    }

    if (!res.ok) {
      console.error(`[github-events] Failed to list repos for ${owner}: ${res.status}`);
      break;
    }

    const data: any[] = await res.json();
    if (data.length === 0) break;

    for (const repo of data) {
      if (!repo.archived && !repo.disabled) {
        repos.push(repo.full_name);
      }
    }

    if (data.length < 100) break;
    page++;
  }

  return repos;
}

async function resolveRepos(patterns: string[], token: string): Promise<string[]> {
  const resolved: string[] = [];

  for (const pattern of patterns) {
    if (isWildcard(pattern)) {
      const owner = pattern.slice(0, -2);
      const orgRepos = await resolveOrgRepos(owner, token);
      console.error(`[github-events] Resolved ${pattern} to ${orgRepos.length} repos`);
      resolved.push(...orgRepos);
    } else {
      resolved.push(pattern);
    }
  }

  return [...new Set(resolved)];
}

const WATCHED_EVENT_TYPES = new Set([
  "PullRequestEvent",
  "PullRequestReviewEvent",
  "PullRequestReviewCommentEvent",
  "IssuesEvent",
  "IssueCommentEvent",
]);

// --- State management ---

function loadState(path: string): StateFile {
  if (!existsSync(path)) {
    return { repos: {} };
  }
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return { repos: {} };
  }
}

function saveState(path: string, state: StateFile): void {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, JSON.stringify(state, null, 2) + "\n");
}

// --- GitHub API ---

interface PollResult {
  events: RawGitHubEvent[];
  etag: string | null;
  pollInterval: number | null;
  error?: string;
}

// --- Health tracking ---

type PollSource = "repo_events" | "workflow_runs" | "notifications";

interface HealthError {
  timestamp: string;
  source: PollSource;
  message: string;
}

interface SourceHealth {
  lastSuccessAt: string | null;
  lastError: HealthError | null;
}

export interface PollerStatus {
  authenticatedUser: string;
  monitoredRepos: string[];
  pollIntervalSeconds: number;
  sources: Record<PollSource, SourceHealth>;
  recentErrors: HealthError[];
  coverage: {
    serverStartedAt: string | null;
    oldestBufferedEvent: string | null;
    bufferedEventCount: number;
  };
}

const MAX_RECENT_ERRORS = 20;

function githubHeaders(token: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function pollRepoEvents(
  repo: string,
  etag: string | null,
  token: string
): Promise<PollResult> {
  const headers = githubHeaders(token);
  if (etag) {
    headers["If-None-Match"] = etag;
  }

  const url = `${API}/repos/${repo}/events?per_page=100`;
  const res = await fetch(url, { headers });

  const newEtag = res.headers.get("etag");
  const pollIntervalHeader = res.headers.get("x-poll-interval");
  const pollInterval = pollIntervalHeader ? parseInt(pollIntervalHeader, 10) : null;

  if (res.status === 304) {
    return { events: [], etag: newEtag ?? etag, pollInterval };
  }

  if (res.status === 403 || res.status === 429) {
    const resetHeader = res.headers.get("x-ratelimit-reset");
    const resetAt = resetHeader ? new Date(parseInt(resetHeader, 10) * 1000).toISOString() : "unknown";
    const msg = `Rate limited for ${repo}. Resets at ${resetAt}`;
    console.error(`[github-events] ${msg}`);
    return { events: [], etag: newEtag ?? etag, pollInterval, error: msg };
  }

  if (!res.ok) {
    const msg = `Error polling ${repo}: ${res.status} ${res.statusText}`;
    console.error(`[github-events] ${msg}`);
    return { events: [], etag: newEtag ?? etag, pollInterval, error: msg };
  }

  const events: RawGitHubEvent[] = await res.json();
  return { events, etag: newEtag, pollInterval };
}

// --- GitHub API detail fetching ---

export async function fetchGitHubApi(url: string, token: string, cache: Cache): Promise<Record<string, any> | null> {
  if (cache.hasApiResponse(url)) return cache.getApiResponse(url) ?? null;

  const headers = githubHeaders(token);
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.error(`[github-events] Failed to fetch ${url}: ${res.status}`);
      cache.setApiResponse(url, null);
      return null;
    }
    const data = await res.json();
    cache.setApiResponse(url, data);
    return data;
  } catch (err) {
    console.error(`[github-events] Error fetching ${url}:`, err);
    cache.setApiResponse(url, null);
    return null;
  }
}

// --- Event formatting ---

function collapseWhitespace(text: string | undefined | null): string {
  if (!text) return "";
  return text.replace(/\r?\n/g, " ").trim();
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + "...";
}

function htmlUrlFromApiUrl(apiUrl: string): string {
  return apiUrl
    .replace("api.github.com/repos/", "github.com/")
    .replace("/pulls/", "/pull/");
}

async function formatPullRequestEvent(event: RawGitHubEvent, token: string, cache: Cache): Promise<PullRequestEvent | null> {
  const { payload } = event;
  const action = payload.action;
  const pr = payload.pull_request;
  if (!pr) return null;

  const full = await fetchGitHubApi(pr.url, token, cache);

  const title = full?.title ?? `${pr.head?.ref ?? "unknown"}`;
  const merged = action === "closed" && (full?.merged ?? false);
  const displayAction = merged ? "merged" : action;

  return {
    type: "PullRequestEvent",
    action: displayAction,
    repo: event.repo.name,
    actor: event.actor.display_login ?? event.actor.login,
    timestamp: event.created_at,
    title,
    state: merged ? "merged" : (full?.state ?? action),
    body: collapseWhitespace(full?.body),
    base: full?.base?.ref ?? pr.base?.ref,
    head: full?.head?.ref ?? pr.head?.ref,
    labels: full?.labels?.map((l: any) => l.name) ?? [],
    draft: full?.draft ?? false,
    additions: full?.additions,
    deletions: full?.deletions,
    changed_files: full?.changed_files,
    refs: {
      pr: {
        number: pr.number,
        title,
        html_url: full?.html_url ?? htmlUrlFromApiUrl(pr.url),
        api_url: pr.url,
        diff_url: full?.diff_url ?? `${htmlUrlFromApiUrl(pr.url)}.diff`,
      },
    },
  };
}

async function formatPullRequestReviewEvent(event: RawGitHubEvent, token: string, cache: Cache): Promise<PullRequestReviewEvent | null> {
  const { payload } = event;
  const review = payload.review;
  const pr = payload.pull_request;
  if (!review || !pr) return null;

  const fullPr = pr.title ? null : await fetchGitHubApi(pr.url, token, cache);
  const prTitle = pr.title ?? fullPr?.title ?? `${pr.head?.ref ?? "unknown"}`;
  const prHtmlUrl = pr.html_url ?? fullPr?.html_url ?? htmlUrlFromApiUrl(pr.url);

  return {
    type: "PullRequestReviewEvent",
    action: payload.action,
    repo: event.repo.name,
    actor: event.actor.display_login ?? event.actor.login,
    timestamp: event.created_at,
    review_state: review.state,
    body: collapseWhitespace(review.body),
    refs: {
      pr: {
        number: pr.number,
        title: prTitle,
        html_url: prHtmlUrl,
        api_url: pr.url,
      },
      review: {
        html_url: review.html_url,
        api_url: review.url,
      },
    },
  };
}

async function formatPullRequestReviewCommentEvent(event: RawGitHubEvent, token: string, cache: Cache): Promise<PullRequestReviewCommentEvent | null> {
  const { payload } = event;
  const comment = payload.comment;
  const pr = payload.pull_request;
  if (!comment || !pr) return null;

  const fullPr = pr.title ? null : await fetchGitHubApi(pr.url, token, cache);
  const prTitle = pr.title ?? fullPr?.title ?? `${pr.head?.ref ?? "unknown"}`;
  const prHtmlUrl = pr.html_url ?? fullPr?.html_url ?? htmlUrlFromApiUrl(pr.url);

  return {
    type: "PullRequestReviewCommentEvent",
    action: payload.action,
    repo: event.repo.name,
    actor: event.actor.display_login ?? event.actor.login,
    timestamp: event.created_at,
    path: comment.path,
    position: comment.position,
    diff_hunk: collapseWhitespace(comment.diff_hunk),
    body: collapseWhitespace(comment.body),
    refs: {
      pr: {
        number: pr.number,
        title: prTitle,
        html_url: prHtmlUrl,
        api_url: pr.url,
      },
      comment: {
        html_url: comment.html_url,
        api_url: comment.url,
      },
    },
  };
}

async function formatIssuesEvent(event: RawGitHubEvent, token: string, cache: Cache): Promise<IssuesEvent | null> {
  const { payload } = event;
  const issue = payload.issue;
  if (!issue) return null;

  return {
    type: "IssuesEvent",
    action: payload.action,
    repo: event.repo.name,
    actor: event.actor.display_login ?? event.actor.login,
    timestamp: event.created_at,
    title: issue.title,
    state: issue.state,
    body: collapseWhitespace(issue.body),
    labels: issue.labels?.map((l: any) => l.name) ?? [],
    assignees: issue.assignees?.map((a: any) => a.login) ?? [],
    refs: {
      issue: {
        number: issue.number,
        title: issue.title,
        html_url: issue.html_url,
        api_url: issue.url,
      },
    },
  };
}

async function formatIssueCommentEvent(event: RawGitHubEvent, token: string, cache: Cache): Promise<IssueCommentEvent | null> {
  const { payload } = event;
  const comment = payload.comment;
  const issue = payload.issue;
  if (!comment || !issue) return null;

  const isPR = !!issue.pull_request;

  return {
    type: "IssueCommentEvent",
    action: payload.action,
    repo: event.repo.name,
    actor: event.actor.display_login ?? event.actor.login,
    timestamp: event.created_at,
    is_pull_request: isPR,
    body: collapseWhitespace(comment.body),
    refs: {
      issue: {
        number: issue.number,
        title: issue.title,
        html_url: issue.html_url,
        api_url: issue.url,
      },
      comment: {
        html_url: comment.html_url,
        api_url: comment.url,
      },
    },
  };
}

type Formatter = (event: RawGitHubEvent, token: string, cache: Cache) => Promise<Event | null>;

const formatters: Record<string, Formatter> = {
  PullRequestEvent: formatPullRequestEvent,
  PullRequestReviewEvent: formatPullRequestReviewEvent,
  PullRequestReviewCommentEvent: formatPullRequestReviewCommentEvent,
  IssuesEvent: formatIssuesEvent,
  IssueCommentEvent: formatIssueCommentEvent,
};

async function formatEvent(event: RawGitHubEvent, token: string, cache: Cache): Promise<Event | null> {
  const formatter = formatters[event.type];
  if (!formatter) return null;
  const formatted = await formatter(event, token, cache);
  if (formatted) {
    cache.setEvent(event.id, formatted);
  }
  return formatted;
}

const TRUNCATE_BODY = 200;
const TRUNCATE_DIFF_HUNK = 200;

export function truncateEvent(event: Event): Event {
  const truncated = { ...event, body: truncate(event.body, TRUNCATE_BODY) };
  if (event.type === "PullRequestReviewCommentEvent") {
    return { ...truncated, diff_hunk: truncate(event.diff_hunk, TRUNCATE_DIFF_HUNK) } as Event;
  }
  return truncated as Event;
}

// --- Event processing ---

function isEventTooOld(event: RawGitHubEvent, maxAgeHours: number): boolean {
  const eventTime = new Date(event.created_at).getTime();
  const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000;
  return eventTime < cutoff;
}

async function processEvents(
  events: RawGitHubEvent[],
  repoState: RepoState | undefined,
  isFirstRun: boolean,
  config: PollerConfig,
  cache: Cache,
  authenticatedUser: string
): Promise<{ newEvents: { id: string; event: Event }[]; latestEventId: string | null }> {
  const reversed = [...events].reverse();

  let latestEventId: string | null = null;
  const newEvents: { id: string; event: Event }[] = [];

  const lastSeenId = repoState?.lastEventId;
  const lastPollAt = repoState?.lastPollAt ? new Date(repoState.lastPollAt).getTime() : 0;
  let pastLastSeen = !lastSeenId;
  const lastSeenStillInPage = lastSeenId ? reversed.some((e) => e.id === lastSeenId) : false;

  if (lastSeenId && !lastSeenStillInPage && lastPollAt > 0) {
    pastLastSeen = true;
  }

  for (const event of reversed) {
    if (!pastLastSeen) {
      if (event.id === lastSeenId) {
        pastLastSeen = true;
      }
      latestEventId = event.id;
      continue;
    }

    latestEventId = event.id;

    if (!lastSeenStillInPage && lastPollAt > 0) {
      const eventTime = new Date(event.created_at).getTime();
      if (eventTime <= lastPollAt) continue;
    }

    if (!WATCHED_EVENT_TYPES.has(event.type)) continue;
    if (isEventTooOld(event, config.maxEventAgeHours)) continue;
    if (isFirstRun) continue;

    const formatted = await formatEvent(event, config.githubToken, cache);
    if (formatted) {
      const filterResult = applyFilters(formatted, authenticatedUser);
      if (filterResult) {
        console.error(`[github-events] Filtered ${formatted.type} (${formatted.action}) on ${formatted.repo}: ${filterResult.reason}`);
        continue;
      }
      newEvents.push({ id: event.id, event: formatted });
    }
  }

  return { newEvents: collapseLabelEvents(newEvents), latestEventId };
}

function collapseLabelEvents(
  events: { id: string; event: Event }[]
): { id: string; event: Event }[] {
  const prLabelBatches = new Map<string, { ids: string[]; events: (Event & { type: "PullRequestEvent" })[] }>();
  const result: { id: string; event: Event }[] = [];

  for (const entry of events) {
    const ev = entry.event;
    if (ev.type === "PullRequestEvent" && (ev.action === "labeled" || ev.action === "unlabeled")) {
      const key = `${ev.repo}#${ev.refs.pr.number}`;
      let batch = prLabelBatches.get(key);
      if (!batch) {
        batch = { ids: [], events: [] };
        prLabelBatches.set(key, batch);
      }
      batch.ids.push(entry.id);
      batch.events.push(ev);
    } else {
      result.push(entry);
    }
  }

  for (const [, batch] of prLabelBatches) {
    const last = batch.events[batch.events.length - 1];
    const merged: Event = {
      ...last,
      action: "labels-changed",
    };
    result.push({ id: batch.ids[batch.ids.length - 1], event: merged });
  }

  return result;
}

// --- Poller ---

export type EventCallback = (eventId: string, event: Event) => void;

const REPO_REFRESH_INTERVAL = 3600_000;

export class Poller {
  private config: PollerConfig;
  private cache: Cache;
  private state: StateFile;
  private onEvent: EventCallback;
  private running = false;
  private resolvedRepos: string[] = [];
  private lastRepoRefresh = 0;
  private authenticatedUser = "";
  private health: Record<PollSource, SourceHealth> = {
    repo_events: { lastSuccessAt: null, lastError: null },
    workflow_runs: { lastSuccessAt: null, lastError: null },
    notifications: { lastSuccessAt: null, lastError: null },
  };
  private recentErrors: HealthError[] = [];
  private startedAt: string | null = null;

  constructor(config: PollerConfig, cache: Cache, onEvent: EventCallback) {
    this.config = config;
    this.cache = cache;
    this.state = loadState(config.stateFilePath);
    this.onEvent = onEvent;
  }

  private recordError(source: PollSource, message: string): void {
    const entry: HealthError = { timestamp: new Date().toISOString(), source, message };
    this.health[source].lastError = entry;
    this.recentErrors.push(entry);
    if (this.recentErrors.length > MAX_RECENT_ERRORS) {
      this.recentErrors.shift();
    }
  }

  private recordSuccess(source: PollSource): void {
    this.health[source].lastSuccessAt = new Date().toISOString();
  }

  getStatus(): PollerStatus {
    return {
      authenticatedUser: this.authenticatedUser,
      monitoredRepos: [...this.resolvedRepos],
      pollIntervalSeconds: this.config.pollInterval || 60,
      sources: structuredClone(this.health),
      recentErrors: [...this.recentErrors],
      coverage: {
        serverStartedAt: this.startedAt,
        oldestBufferedEvent: this.cache.getOldestEventTimestamp(),
        bufferedEventCount: this.cache.getEventCount(),
      },
    };
  }

  private async refreshRepos(): Promise<void> {
    if (Date.now() - this.lastRepoRefresh < REPO_REFRESH_INTERVAL && this.resolvedRepos.length > 0) {
      return;
    }
    this.resolvedRepos = await resolveRepos(this.config.repos, this.config.githubToken);
    this.lastRepoRefresh = Date.now();
  }

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

  stop(): void {
    this.running = false;
  }

  // --- Workflow run polling ---

  private async pollWorkflowRuns(): Promise<void> {
    if (!this.state.workflowRuns) {
      this.state.workflowRuns = {};
    }

    let hadError = false;
    for (const repo of this.resolvedRepos) {
      try {
        await this.pollWorkflowRunsForRepo(repo);
      } catch (err) {
        const msg = `Error polling workflow runs for ${repo}: ${err}`;
        console.error(`[github-events] ${msg}`);
        this.recordError("workflow_runs", msg);
        hadError = true;
      }
    }
    if (!hadError) {
      this.recordSuccess("workflow_runs");
    }
  }

  private async pollWorkflowRunsForRepo(repo: string): Promise<void> {
    const runState = this.state.workflowRuns![repo];
    const isFirstRun = !runState;

    const since = runState?.lastPollAt
      ?? new Date(Date.now() - this.config.maxEventAgeHours * 3600_000).toISOString();
    const sinceDate = since.slice(0, 10);

    // Fetch completed runs (success + failure)
    const completedUrl = `${API}/repos/${repo}/actions/runs?status=completed&per_page=30&created=>${sinceDate}`;
    // Fetch runs awaiting approval (first-time contributor workflows)
    const waitingUrl = `${API}/repos/${repo}/actions/runs?status=action_required&per_page=10`;

    const [completedRes, waitingRes] = await Promise.all([
      fetch(completedUrl, { headers: githubHeaders(this.config.githubToken) }),
      fetch(waitingUrl, { headers: githubHeaders(this.config.githubToken) }),
    ]);

    if (completedRes.status === 403 || completedRes.status === 429) {
      this.recordError("workflow_runs", `Rate limited polling workflow runs for ${repo}`);
      return;
    }
    if (!completedRes.ok) {
      const msg = `Error polling workflow runs for ${repo}: ${completedRes.status}`;
      console.error(`[github-events] ${msg}`);
      this.recordError("workflow_runs", msg);
      return;
    }

    const completedData: any = await completedRes.json();
    const waitingData: any = waitingRes.ok ? await waitingRes.json() : { workflow_runs: [] };
    const runs: any[] = [
      ...(completedData.workflow_runs ?? []),
      ...(waitingData.workflow_runs ?? []).map((r: any) => ({ ...r, conclusion: "action_required" })),
    ];

    let maxRunId = runState?.lastRunId ?? 0;

    for (const run of runs) {
      if (run.id <= (runState?.lastRunId ?? 0)) continue;
      if (run.id > maxRunId) maxRunId = run.id;
      if (isFirstRun) continue;

      const formatted = await this.formatWorkflowRun(run, repo);
      if (!formatted) continue;

      const eventId = `wfrun-${run.id}`;
      this.cache.setEvent(eventId, formatted);
      this.onEvent(eventId, formatted);
    }

    this.state.workflowRuns![repo] = {
      lastRunId: maxRunId,
      lastPollAt: new Date().toISOString(),
    };
  }

  private async formatWorkflowRun(run: any, repo: string): Promise<WorkflowRunEvent | null> {
    const triggerEvent: string = run.event ?? "unknown";
    let prRef: NumberedRef | undefined;

    if (triggerEvent === "pull_request" || triggerEvent === "pull_request_target") {
      if (run.pull_requests?.length > 0) {
        const prData = run.pull_requests[0];
        const prUrl: string = prData.url;
        const fullPr = await fetchGitHubApi(prUrl, this.config.githubToken, this.cache);

        if (fullPr) {
          prRef = {
            number: fullPr.number ?? prData.number,
            title: fullPr.title ?? "",
            html_url: fullPr.html_url ?? htmlUrlFromApiUrl(prUrl),
            api_url: prUrl,
          };
        }
      }
    }

    return {
      type: "WorkflowRunEvent",
      repo,
      actor: run.actor?.login ?? "unknown",
      timestamp: run.updated_at ?? run.created_at,
      action: "completed",
      body: `Workflow "${run.name ?? run.display_title}" ${run.conclusion} on ${triggerEvent} (branch: ${run.head_branch})`,
      workflow_name: run.name ?? run.display_title ?? "unknown",
      conclusion: run.conclusion,
      trigger_event: triggerEvent,
      head_branch: run.head_branch ?? "",
      run_number: run.run_number,
      run_attempt: run.run_attempt,
      refs: {
        run: {
          html_url: run.html_url,
          api_url: `${API}/repos/${repo}/actions/runs/${run.id}`,
        },
        ...(prRef ? { pr: prRef } : {}),
      },
    };
  }

  // --- Notification polling ---

  private async pollNotifications(): Promise<void> {
    if (!this.authenticatedUser) return;

    try {
      const since = this.state.lastNotificationAt;
      let url = `${API}/notifications?participating=true&per_page=50`;
      if (since) {
        url += `&since=${since}`;
      }

      const res = await fetch(url, { headers: githubHeaders(this.config.githubToken) });

      if (res.status === 403 || res.status === 429) {
        this.recordError("notifications", "Rate limited polling notifications");
        return;
      }
      if (!res.ok) {
        const msg = `Notifications poll failed: ${res.status}`;
        console.error(`[github-events] ${msg}`);
        this.recordError("notifications", msg);
        return;
      }

      const notifications: any[] = await res.json();
      if (notifications.length === 0) {
        if (!this.state.lastNotificationAt) {
          this.state.lastNotificationAt = new Date().toISOString();
        }
        this.recordSuccess("notifications");
        return;
      }

      const watchedRepoSet = new Set(this.resolvedRepos);
      const isFirstRun = !this.state.lastNotificationAt;

      let latestUpdatedAt = since ?? "";

      for (const notif of notifications) {
        if (notif.updated_at > latestUpdatedAt) {
          latestUpdatedAt = notif.updated_at;
        }

        if (isFirstRun) continue;

        if (notif.reason === "author" || notif.reason === "state_change") continue;

        const repoFullName = notif.repository?.full_name;
        if (repoFullName && watchedRepoSet.has(repoFullName)) continue;

        const formatted = await this.formatNotification(notif);
        if (!formatted) continue;

        const eventId = `notif-${notif.id}`;
        this.cache.setEvent(eventId, formatted);
        this.onEvent(eventId, formatted);
      }

      this.state.lastNotificationAt = latestUpdatedAt || new Date().toISOString();
      this.recordSuccess("notifications");
    } catch (err) {
      const msg = `Error polling notifications: ${err}`;
      console.error(`[github-events] ${msg}`);
      this.recordError("notifications", msg);
    }
  }

  private async formatNotification(notif: any): Promise<NotificationEvent | null> {
    const subject = notif.subject;
    if (!subject) return null;

    if (subject.type !== "Issue" && subject.type !== "PullRequest") return null;

    let body = "";
    let actor = "unknown";
    let commentRef: Ref | undefined;

    if (subject.latest_comment_url) {
      const commentData = await fetchGitHubApi(
        subject.latest_comment_url, this.config.githubToken, this.cache
      );
      if (commentData) {
        body = collapseWhitespace(commentData.body);
        actor = commentData.user?.login ?? "unknown";
        commentRef = {
          html_url: commentData.html_url ?? "",
          api_url: subject.latest_comment_url,
        };
      }
    }

    if (actor === this.authenticatedUser) return null;

    const subjectApiUrl: string = subject.url ?? "";
    const isPR = subject.type === "PullRequest";

    return {
      type: "NotificationEvent",
      repo: notif.repository?.full_name ?? "unknown",
      actor,
      timestamp: notif.updated_at,
      action: notif.reason,
      notification_reason: notif.reason,
      subject_type: subject.type,
      subject_title: subject.title,
      is_pull_request: isPR,
      body,
      refs: {
        subject: {
          html_url: htmlUrlFromApiUrl(subjectApiUrl),
          api_url: subjectApiUrl,
        },
        ...(commentRef ? { comment: commentRef } : {}),
      },
    };
  }

  // --- Main poll loop ---

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
        this.recordError("repo_events", error);
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
      this.recordSuccess("repo_events");
    }

    await this.pollWorkflowRuns();
    await this.pollNotifications();

    saveState(this.config.stateFilePath, this.state);
    return maxPollInterval;
  }
}
