/**
 * Finds the dashboards of every installed plugin, through the ~/.jay/plugins
 * links, and whether each is running.
 *
 * Copied into every plugin with a dashboard from tools/plugin/dashboard/;
 * edit it there.
 */

import { readdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

/** A menu entry a dashboard declares in its dashboard.json. */
export interface View {
  id: string;
  label: string;
  icon: string;
}

/** A dashboard.json, which says where a plugin's dashboard runs and what it shows. */
export interface Manifest {
  title: string;
  port: number;
  views: View[];
}

/** An installed dashboard, as the menu needs it. */
export interface Dashboard extends Manifest {
  plugin: string;
  dir: string;
}

/** A count beside a view in the menu, and whether it needs attention. */
export interface Badge {
  n: number;
  alert: boolean;
}

const PLUGINS = join(homedir(), ".jay", "plugins");
const PROBE_MS = 500;

/** Reads a dashboard.json. */
export async function readManifest(dir: string): Promise<Manifest> {
  return JSON.parse(await readFile(join(dir, "dashboard.json"), "utf8"));
}

/** Every installed plugin that has a dashboard, by plugin name. */
export async function installed(): Promise<Dashboard[]> {
  let plugins: string[];
  try {
    plugins = await readdir(PLUGINS);
  } catch {
    return [];
  }
  const found = await Promise.all(plugins.sort().map(async (plugin) => {
    const dir = join(PLUGINS, plugin, "dashboard");
    try {
      return { plugin, dir, ...(await readManifest(dir)) };
    } catch {
      return null;
    }
  }));
  return found.filter((d): d is Dashboard => d !== null);
}

/** Whether the dashboard answering on `port` is the named plugin's. */
export async function running(plugin: string, port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(PROBE_MS) });
    return res.ok && (await res.json()).plugin === plugin;
  } catch {
    return false;
  }
}

/** A running dashboard's menu counts, or none when it does not answer in time. */
export async function badgesOf(port: number): Promise<Record<string, Badge>> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/badges`, { signal: AbortSignal.timeout(PROBE_MS) });
    return res.ok ? await res.json() : {};
  } catch {
    return {};
  }
}
