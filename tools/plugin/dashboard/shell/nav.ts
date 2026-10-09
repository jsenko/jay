/**
 * The menu across dashboards: what every installed dashboard shows, and
 * starting one that is not running.
 *
 * Shared by every plugin's dashboard through a link.
 */

import { spawn } from "node:child_process";
import { join } from "node:path";

import { type Badge, type View, badgesOf, installed, running } from "./discover.js";
import { HttpError } from "./http.js";

/** A dashboard as the menu draws it. */
export interface NavEntry {
  plugin: string;
  title: string;
  url: string;
  running: boolean;
  views: (View & { badge?: Badge })[];
}

const urlOf = (port: number) => `http://localhost:${port}`;

/**
 * Every installed dashboard with its views and counts. This dashboard's counts come
 * from `ownBadges`; the others' are fetched from them, so the browser never makes a
 * cross-origin request.
 */
export async function nav(self: string, ownBadges: () => Promise<Record<string, Badge>>): Promise<NavEntry[]> {
  return Promise.all((await installed()).map(async (d) => {
    const isSelf = d.plugin === self;
    const up = isSelf || (await running(d.plugin, d.port));
    const badges = isSelf ? await ownBadges() : up ? await badgesOf(d.port) : {};
    return {
      plugin: d.plugin,
      title: d.title,
      url: urlOf(d.port),
      running: up,
      views: d.views.map((v) => ({ ...v, ...(badges[v.id] && { badge: badges[v.id] }) })),
    };
  }));
}

/**
 * Starts an installed plugin's dashboard with its `run.sh start`, unless it is running,
 * and returns its URL. The script runs in a session of its own, so the dashboard it
 * starts outlives this one.
 */
export async function start(plugin: string): Promise<{ url: string }> {
  const dashboard = (await installed()).find((d) => d.plugin === plugin);
  if (!dashboard) throw new HttpError(404, `no dashboard installed for ${plugin}`);
  const url = urlOf(dashboard.port);
  if (await running(plugin, dashboard.port)) return { url };

  const script = spawn(join(dashboard.dir, "run.sh"), ["start"], { detached: true, stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  script.stderr.on("data", (chunk) => (stderr += chunk));
  const code = await new Promise<number | null>((resolve) => {
    script.on("error", () => resolve(null));
    script.on("close", resolve);
  });
  if (code !== 0) throw new HttpError(502, stderr.trim() || `${plugin}'s dashboard did not start`);
  return { url };
}
