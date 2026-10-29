/** Polling a repository's event stream and deciding which events are new. */

import type { Cache } from "./cache.js";
import type { PollerConfig } from "./config.js";
import type { Event } from "./event-types.js";
import { applyFilters } from "./filters.js";
import { formatEvent } from "./format.js";
import { API, githubHeaders, type RawGitHubEvent } from "./github.js";
import type { RepoState } from "./state.js";

/** The repository event types a session hears about. */
const WATCHED_EVENT_TYPES = new Set([
  "PullRequestEvent",
  "PullRequestReviewEvent",
  "PullRequestReviewCommentEvent",
  "IssuesEvent",
  "IssueCommentEvent",
]);

/** One page of a repository's events, with what GitHub said about polling. */
interface PollResult {
  events: RawGitHubEvent[];
  etag: string | null;
  pollInterval: number | null;
  error?: string;
}

/**
 * The newest page of a repository's events. With the last ETag, an
 * unchanged stream costs nothing against the rate limit (304).
 */
export async function pollRepoEvents(
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

/** Whether an event is too old to be worth delivering. */
function isEventTooOld(event: RawGitHubEvent, maxAgeHours: number): boolean {
  const eventTime = new Date(event.created_at).getTime();
  const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000;
  return eventTime < cutoff;
}

/**
 * The events on a page that are new since the cursor, formatted and
 * filtered. On a first run nothing is delivered: the page only sets the
 * cursor, so starting to watch doesn't replay the past.
 */
export async function processEvents(
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
    // Pushes come from pull-heads.ts, which sees every one; the stream
    // carries only some, and a second copy would be a second re-review.
    if (event.type === "PullRequestEvent" && event.payload?.action === "synchronize") continue;
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

/**
 * A run of label changes on one PR, as one event: relabelling a PR fires
 * one event per label, which would be noise.
 */
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
