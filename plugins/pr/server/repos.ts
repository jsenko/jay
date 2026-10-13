/** Turning `owner/*` patterns into the repositories they cover. */

import { API, githubHeaders } from "./github.js";

/** Whether a pattern names every repository of an owner. */
function isWildcard(repo: string): boolean {
  return repo.endsWith("/*");
}

/**
 * An owner's active repositories, archived and disabled ones left out.
 * Tried as an organisation first, then as a user.
 */
async function resolveOwnerRepos(owner: string, token: string): Promise<string[]> {
  const repos: string[] = [];
  const headers = githubHeaders(token);
  let page = 1;

  while (true) {
    let url = `${API}/orgs/${owner}/repos?per_page=100&page=${page}`;
    let res = await fetch(url, { headers });

    if (res.status === 404) {
      url = `${API}/users/${owner}/repos?per_page=100&page=${page}`;
      res = await fetch(url, { headers });
    }

    if (!res.ok) {
      console.error(`[github-events] Failed to list repos for ${owner}: ${res.status}`);
      break;
    }

    const data: any[] = await res.json();
    if (data.length === 0) break;

    for (const repo of data) {
      if (!repo.archived && !repo.disabled) {
        repos.push(repo.full_name);
      }
    }

    if (data.length < 100) break;
    page++;
  }

  return repos;
}

/** The repositories a list of patterns covers, each once. */
export async function resolveRepos(patterns: string[], token: string): Promise<string[]> {
  const resolved: string[] = [];

  for (const pattern of patterns) {
    if (isWildcard(pattern)) {
      const owner = pattern.slice(0, -2);
      const ownerRepos = await resolveOwnerRepos(owner, token);
      console.error(`[github-events] Resolved ${pattern} to ${ownerRepos.length} repos`);
      resolved.push(...ownerRepos);
    } else {
      resolved.push(pattern);
    }
  }

  return [...new Set(resolved)];
}
