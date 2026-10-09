/**
 * Request and response helpers shared by every dashboard route.
 *
 * Copied into every plugin with a dashboard from tools/plugin/dashboard/;
 * edit it there.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const CONTENT_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

const MAX_BODY = 64_000;

/** Writes a JSON response. */
export function json(res: ServerResponse, body: unknown, status = 200): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

/**
 * Whether a request may be served. The Host header must name this machine, which
 * stops another site reaching the dashboard by rebinding its DNS name to 127.0.0.1.
 */
export function trusted(req: IncomingMessage, port: number): boolean {
  return [`localhost:${port}`, `127.0.0.1:${port}`].includes(req.headers.host ?? "");
}

/**
 * Reads a JSON request body, capped so a stray client cannot exhaust memory.
 * Anything not sent as JSON is refused: a browser sends JSON from another site
 * only after a preflight, which the dashboard never answers, so a page elsewhere
 * cannot make changes here.
 */
export async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  if (!req.headers["content-type"]?.startsWith("application/json")) {
    throw new HttpError(415, "expected application/json");
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new HttpError(413, "body too large");
    chunks.push(chunk as Buffer);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
}

/** Serves a file from `root`, refusing anything that escapes it. */
export async function serveFile(root: string, pathname: string, res: ServerResponse): Promise<void> {
  const file = join(root, normalize(pathname).replace(/^(\.\.[/\\])+/, ""));
  if (!file.startsWith(root)) {
    res.writeHead(403).end("forbidden");
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": CONTENT_TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
}

/** An error that carries the HTTP status to answer with. */
export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}
