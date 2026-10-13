/** Turning GitHub's raw repository events into what a session is told. */

import type { Cache } from "./cache.js";
import type {
  Event,
  PullRequestEvent,
  PullRequestReviewEvent,
  PullRequestReviewCommentEvent,
  IssuesEvent,
  IssueCommentEvent,
} from "./event-types.js";
import { fetchGitHubApi, htmlUrlFromApiUrl, type RawGitHubEvent } from "./github.js";

/** A body on one line, so pushes and summaries stay compact. */
export function collapseWhitespace(text: string | undefined | null): string {
  if (!text) return "";
  return text.replace(/\r?\n/g, " ").trim();
}

/** Cuts text to `maxLen`, marking the cut with an ellipsis. */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + "...";
}

/** A PR opened, closed, merged, labelled…; fetches the PR for its title, body and size. */
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

/** A review submitted on a PR. */
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

/** A comment on a PR's diff, with the hunk it is on. */
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

/** An issue opened, closed, labelled… */
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

/** A comment on an issue or a PR's conversation. */
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

/** Turns one raw event into what a session sees, or null to drop it. */
type Formatter = (event: RawGitHubEvent, token: string, cache: Cache) => Promise<Event | null>;

/** The formatter for each watched event type. */
const formatters: Record<string, Formatter> = {
  PullRequestEvent: formatPullRequestEvent,
  PullRequestReviewEvent: formatPullRequestReviewEvent,
  PullRequestReviewCommentEvent: formatPullRequestReviewCommentEvent,
  IssuesEvent: formatIssuesEvent,
  IssueCommentEvent: formatIssueCommentEvent,
};

/** Formats an event of a watched type and caches it for `get_event`. */
export async function formatEvent(event: RawGitHubEvent, token: string, cache: Cache): Promise<Event | null> {
  const formatter = formatters[event.type];
  if (!formatter) return null;
  const formatted = await formatter(event, token, cache);
  if (formatted) {
    cache.setEvent(event.id, formatted);
  }
  return formatted;
}

/** How much of a body or diff hunk a push carries; `get_event` has the rest. */
const TRUNCATE_BODY = 200;
const TRUNCATE_DIFF_HUNK = 200;

/** The event as pushed: long fields cut short. */
export function truncateEvent(event: Event): Event {
  const truncated = { ...event, body: truncate(event.body, TRUNCATE_BODY) };
  if (event.type === "PullRequestReviewCommentEvent") {
    return { ...truncated, diff_hunk: truncate(event.diff_hunk, TRUNCATE_DIFF_HUNK) } as Event;
  }
  return truncated as Event;
}
