/**
 * A fake GitHub API, enough for the poller: the authenticated user, a
 * repository's events with ETags, and empty workflow runs and
 * notifications. Tests add events and watch what reaches a session.
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

/** The running fake, and the events it serves. */
export interface FakeGitHub {
  url: string;
  /** Adds an event, as the newest. */
  add(event: RawEvent): void;
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
  const server: Server = createServer((req, res) => {
    const path = (req.url ?? "").split("?")[0];
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
    if (path === "/notifications") return json(200, []);
    return json(404, { message: "Not Found" });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    add: (event) => events.unshift(event),
    close: () => new Promise((r) => server.close(() => r())),
  };
}
