/**
 * A fake GitHub API, enough for the poller: the authenticated user, a
 * repository's events with ETags, empty workflow runs, and notifications
 * with their latest comments. Tests add events and notifications and
 * watch what reaches a session.
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

/** The running fake, and the events it serves. */
export interface FakeGitHub {
  url: string;
  /** The path of every request received, in order. */
  requests: string[];
  /** Adds an event, as the newest. */
  add(event: RawEvent): void;
  /** Adds a notification, or updates the one with its id, and the comment it points to. */
  notify(notification: RawNotification, comment: { body: string; login: string }): void;
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
    if (path.endsWith("/actions/runs")) return json(200, { workflow_runs: [] });
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
    close: () => new Promise((r) => server.close(() => r())),
  };
}
