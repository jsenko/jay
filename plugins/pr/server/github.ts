/** Talking to the GitHub API: where it is, the headers, and cached fetches. */

import type { Cache } from "./cache.js";

/** The GitHub API, overridable so tests can run against a fake. */
export const API = (process.env.GITHUB_API_URL || "https://api.github.com").replace(/\/$/, "");

/** An event as GitHub's events API returns it, before formatting. */
export interface RawGitHubEvent {
  id: string;
  type: string;
  actor: { login: string; display_login?: string };
  repo: { name: string };
  payload: Record<string, any>;
  created_at: string;
}

/** Headers for every API call; the token is left out when there is none. */
export function githubHeaders(token: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Fetches an API URL once, then serves it from the cache. A failure is
 * cached too, as null, so a broken link isn't retried on every event.
 */
export async function fetchGitHubApi(url: string, token: string, cache: Cache): Promise<Record<string, any> | null> {
  if (cache.hasApiResponse(url)) return cache.getApiResponse(url) ?? null;

  const headers = githubHeaders(token);
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.error(`[github-events] Failed to fetch ${url}: ${res.status}`);
      cache.setApiResponse(url, null);
      return null;
    }
    const data = await res.json();
    cache.setApiResponse(url, data);
    return data;
  } catch (err) {
    console.error(`[github-events] Error fetching ${url}:`, err);
    cache.setApiResponse(url, null);
    return null;
  }
}

/** The web page for an API URL, for when the API response has no `html_url`. */
export function htmlUrlFromApiUrl(apiUrl: string): string {
  return apiUrl
    .replace("api.github.com/repos/", "github.com/")
    .replace("/pulls/", "/pull/");
}
