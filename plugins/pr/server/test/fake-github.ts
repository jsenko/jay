/**
 * A fake GitHub API, enough for the poller: the authenticated user, a
 * repository's events with ETags, empty workflow runs, and notifications
 * with their latest comments. Tests add events and notifications and
 * watch what reaches a session. It also serves open pulls, most recently
 * updated first and with an ETag, and a head's checks.
 */

import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

/** A raw event as GitHub's events API returns it. */
export interface RawEvent {
  id: string;
  type: string;
  actor: { login: string };
  repo: { name: string };
  payload: Record<string, unknown>;
  created_at: string;
}

/** A notification as GitHub's notifications API returns it. */
export interface RawNotification {
  id: string;
  reason: string;
  updated_at: string;
  repository: { full_name: string };
  subject: { type: string; title: string; url: string; latest_comment_url?: string };
}

/** What a commit's checks look like: check runs, commit statuses, and runs held for approval. */
export interface FakeChecks {
  runs: { id: number; name: string; status: string; conclusion: string | null; started_at: string | null }[];
  statuses?: { context: string; state: string }[];
  held?: string[];
}

/** The running fake, and the events it serves. */
export interface FakeGitHub {
  url: string;
  /** The path of every request received, in order. */
  requests: string[];
  /** Adds an event, as the newest. */
  add(event: RawEvent): void;
  /** Adds a notification, or updates the one with its id, and the comment it points to. */
  notify(notification: RawNotification, comment: { body: string; login: string }): void;
  /** Adds an open pull to a repository's list; `head` is its head commit. */
  pull(repo: string, pull: Record<string, unknown> & { number: number; head?: string }): void;
  /** Moves an open pull's head, as a push to its branch does. */
  moveHead(repo: string, number: number, sha: string): void;
  /** Takes a pull off the open list. */
  closePull(repo: string, number: number): void;
  /** How many pull list requests were answered 304, unchanged. */
  readonly pullsNotModified: number;
  /** Sets a commit's checks. */
  checks(sha: string, checks: FakeChecks): void;
  /** Makes a repository's pull list fail. */
  breakRepo(repo: string): void;
  close(): Promise<void>;
}

/** Event ids, increasing as GitHub's do. */
let seq = 1000;

/** An issue comment by `actor`, `hoursAgo` hours old. */
export function comment(actor: string, body: string, hoursAgo = 0): RawEvent {
  const id = String(++seq);
  return {
    id,
    type: "IssueCommentEvent",
    actor: { login: actor },
    repo: { name: "acme/widgets" },
    payload: {
      action: "created",
      comment: { body, html_url: `https://github.com/acme/widgets/issues/7#c${id}`, url: `x/comments/${id}` },
      issue: { number: 7, title: "Retry on startup", html_url: "https://github.com/acme/widgets/issues/7", url: "x/issues/7" },
    },
    created_at: new Date(Date.now() - hoursAgo * 3_600_000).toISOString(),
  };
}

/** Starts the fake on a free local port. */
export async function startFake(user = "tester"): Promise<FakeGitHub> {
  const events: RawEvent[] = [];
  const notifications = new Map<string, RawNotification>();
  const comments = new Map<string, unknown>();
  const requests: string[] = [];
  const pulls = new Map<string, Record<string, any>[]>();
  const checks = new Map<string, FakeChecks>();
  const broken = new Set<string>();
  // Bumped on every change to a repository's pulls, for its list's ETag.
  const pullVersions = new Map<string, number>();
  const touch = (repo: string) => pullVersions.set(repo, (pullVersions.get(repo) ?? 0) + 1);
  let pullsNotModified = 0;
  const server: Server = createServer((req, res) => {
    const [path, query] = (req.url ?? "").split("?");
    requests.push(path);
    const json = (status: number, body: unknown, headers: Record<string, string> = {}) => {
      res.writeHead(status, { "content-type": "application/json", ...headers });
      res.end(body === undefined ? "" : JSON.stringify(body));
    };

    if (path === "/user") return json(200, { login: user });
    if (path === "/repos/acme/widgets/events") {
      const etag = `"${events.length}-${events[0]?.id ?? "none"}"`;
      if (req.headers["if-none-match"] === etag) return json(304, undefined, { etag });
      return json(200, events, { etag });
    }
    const repoPulls = path.match(/^\/repos\/([^/]+\/[^/]+)\/pulls(?:\/(\d+))?$/);
    if (repoPulls) {
      const [, repo, number] = repoPulls;
      if (broken.has(repo)) return json(500, { message: "broken" });
      const list = pulls.get(repo) ?? [];
      if (number) {
        const found = list.find((p) => p.number === Number(number));
        return found ? json(200, found) : json(404, { message: "Not Found" });
      }
      const etag = `"${repo}-${pullVersions.get(repo) ?? 0}"`;
      const page = new URLSearchParams(query).get("page");
      if (page === "1" && req.headers["if-none-match"] === etag) {
        pullsNotModified++;
        return json(304, undefined, { etag });
      }
      const newestFirst = [...list].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
      return json(200, page === "1" ? newestFirst : [], { etag });
    }
    const commit = path.match(/\/commits\/([^/]+)\/(check-runs|status)$/);
    if (commit) {
      const found = checks.get(commit[1]) ?? { runs: [] };
      return commit[2] === "check-runs" ? json(200, { check_runs: found.runs }) : json(200, { statuses: found.statuses ?? [] });
    }
    if (path.endsWith("/actions/runs")) {
      const sha = new URLSearchParams(query).get("head_sha");
      const held = sha ? (checks.get(sha)?.held ?? []) : [];
      return json(200, { workflow_runs: held.map((name) => ({ name, status: "action_required" })) });
    }
    if (path === "/notifications") {
      // Like GitHub, `since` includes notifications updated at that instant.
      const since = new URLSearchParams(query).get("since") ?? "";
      return json(200, [...notifications.values()].filter((n) => n.updated_at >= since));
    }
    if (comments.has(path)) return json(200, comments.get(path));
    return json(404, { message: "Not Found" });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    add: (event) => events.unshift(event),
    notify: (notification, comment) => {
      notifications.set(notification.id, notification);
      const url = notification.subject.latest_comment_url;
      if (url) comments.set(new URL(url).pathname, { body: comment.body, user: { login: comment.login }, html_url: url });
    },
    pull: (repo, pull) => {
      const { head, ...rest } = pull;
      const html_url = `https://github.com/${repo}/pull/${pull.number}`;
      pulls.set(repo, [...(pulls.get(repo) ?? []), {
        html_url, url: `x/repos/${repo}/pulls/${pull.number}`, diff_url: `${html_url}.diff`, state: "open",
        updated_at: new Date().toISOString(), head: { sha: head ?? `sha-${pull.number}`, ref: `branch-${pull.number}` }, ...rest,
      }]);
      touch(repo);
    },
    moveHead: (repo, number, sha) => {
      const found = pulls.get(repo)?.find((p) => p.number === number);
      if (!found) throw new Error(`no pull ${repo}#${number}`);
      found.head = { ...found.head, sha };
      found.updated_at = new Date().toISOString();
      touch(repo);
    },
    closePull: (repo, number) => {
      pulls.set(repo, (pulls.get(repo) ?? []).filter((p) => p.number !== number));
      touch(repo);
    },
    get pullsNotModified() {
      return pullsNotModified;
    },
    checks: (sha, value) => checks.set(sha, value),
    breakRepo: (repo) => broken.add(repo),
    close: () => new Promise((r) => server.close(() => r())),
  };
}
