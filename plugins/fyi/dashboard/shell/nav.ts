/**
 * The menu across dashboards: what every installed dashboard shows, and
 * starting one that is not running.
 *
 * Copied into every plugin with a dashboard from tools/plugin/dashboard/;
 * edit it there.
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

const START_WAIT_MS = 8_000;
const START_POLL_MS = 200;

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

/** Starts an installed plugin's dashboard, unless it is running, and returns its URL. */
export async function start(plugin: string): Promise<{ url: string }> {
  const dashboard = (await installed()).find((d) => d.plugin === plugin);
  if (!dashboard) throw new HttpError(404, `no dashboard installed for ${plugin}`);
  const url = urlOf(dashboard.port);
  if (await running(plugin, dashboard.port)) return { url };

  spawn(join(dashboard.dir, "start.sh"), [], { detached: true, stdio: "ignore" }).unref();
  for (let waited = 0; waited < START_WAIT_MS; waited += START_POLL_MS) {
    await new Promise((resolve) => setTimeout(resolve, START_POLL_MS));
    if (await running(plugin, dashboard.port)) return { url };
  }
  throw new HttpError(502, `${plugin}'s dashboard did not start; run ${join(dashboard.dir, "start.sh")} to see why`);
}
