/**
 * The server every plugin's dashboard runs on. The plugin supplies its data, its
 * counts and its actions; the shell supplies the page frame, the shared menu, and
 * the routes other dashboards rely on (/health, /badges, /nav).
 *
 * Copied into every plugin with a dashboard from tools/plugin/dashboard/;
 * edit it there.
 */

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { type Badge, readManifest } from "./discover.js";
import { HttpError, json, readJson, serveFile, trusted } from "./http.js";
import { nav, start } from "./nav.js";

/** What a plugin's dashboard provides. */
export interface DashboardOptions {
  /** The plugin's dashboard directory, holding dashboard.json and public/. */
  dir: string;
  /** Everything the page shows, for GET /api/state. */
  state: (params: URLSearchParams) => unknown | Promise<unknown>;
  /** Counts beside this dashboard's views in the menu, by view id. */
  badges: () => Record<string, Badge> | Promise<Record<string, Badge>>;
  /** Changes the page can make, by path (`/api/<name>`), each given the JSON body. */
  actions?: Record<string, (body: Record<string, unknown>) => unknown | Promise<unknown>>;
}

const SHELL_PUBLIC = join(dirname(fileURLToPath(import.meta.url)), "public");

/** Starts the dashboard on the port its dashboard.json declares, on this machine only. */
export async function serve({ dir, state, badges, actions = {} }: DashboardOptions): Promise<void> {
  const { title, port } = await readManifest(dir);
  const manifestPath = join(dir, "..", ".claude-plugin", "plugin.json");
  const plugin: string = JSON.parse(await readFile(manifestPath, "utf8")).name;
  const ownBadges = async () => badges();

  const server = createServer(async (req, res) => {
    if (!trusted(req, port)) {
      res.writeHead(403).end("forbidden");
      return;
    }
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);
    const post = req.method === "POST";

    try {
      if (url.pathname === "/health") return json(res, { plugin, title });
      if (url.pathname === "/badges") return json(res, await ownBadges());
      if (url.pathname === "/nav") return json(res, { current: plugin, dashboards: await nav(plugin, ownBadges) });
      if (url.pathname === "/nav/start" && post) return json(res, await start(String((await readJson(req)).plugin)));
      if (url.pathname === "/api/state") return json(res, await state(url.searchParams));
      if (post && actions[url.pathname]) return json(res, await actions[url.pathname](await readJson(req)));
      if (url.pathname === "/") return serveFile(SHELL_PUBLIC, "/index.html", res);
      if (url.pathname.startsWith("/shell/")) return serveFile(SHELL_PUBLIC, url.pathname.slice("/shell".length), res);
      await serveFile(join(dir, "public"), url.pathname, res);
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      json(res, { error: (err as Error).message }, status);
    }
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`${title} dashboard on http://localhost:${port}`);
  });
}
