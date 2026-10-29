/**
 * Pushes to open PRs, found by watching each PR's head move between
 * rounds. The event stream misses them: a push to a same-repository
 * branch rarely arrives as a `synchronize`, and a fork's pushes happen in
 * the fork, outside the watched repository's stream entirely.
 */

import type { PollContext } from "./context.js";
import type { PullRequestEvent } from "./event-types.js";
import { applyFilters } from "./filters.js";
import { collapseWhitespace } from "./format.js";
import { API, githubHeaders } from "./github.js";

/** Pulls per page, GitHub's maximum. */
const PAGE_SIZE = 100;

/** Polls every watched repository's open PR heads, recording one health result for all. */
export async function pollPullHeads(ctx: PollContext): Promise<void> {
  ctx.state.pullHeads ??= {};

  let hadError = false;
  for (const repo of ctx.repos) {
    try {
      await pollRepo(ctx, repo);
    } catch (err: any) {
      const msg = `Error polling PR heads for ${repo}: ${err.message ?? err}`;
      console.error(`[github-events] ${msg}`);
      ctx.health.error("pull_heads", msg);
      hadError = true;
    }
  }
  if (!hadError) {
    ctx.health.success("pull_heads");
  }
}

/**
 * Reads one repository's open PRs and reports each whose head moved. The
 * list is sorted by last update, so any change to any PR changes the
 * first page, and an unchanged first page (a 304, free against the rate
 * limit) means nothing moved. A first run only records the heads.
 */
async function pollRepo(ctx: PollContext, repo: string): Promise<void> {
  const known = ctx.state.pullHeads![repo];
  const pulls: any[] = [];
  let etag: string | null = null;

  for (let page = 1; ; page++) {
    const headers = githubHeaders(ctx.config.githubToken);
    if (page === 1 && known?.etag) headers["If-None-Match"] = known.etag;

    const res = await fetch(
      `${API}/repos/${repo}/pulls?state=open&sort=updated&direction=desc&per_page=${PAGE_SIZE}&page=${page}`,
      { headers }
    );
    if (res.status === 304) return;
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    if (page === 1) etag = res.headers.get("etag");

    const batch: any[] = await res.json();
    pulls.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }

  if (known) {
    for (const pull of pulls) {
      const before = known.heads[pull.number];
      if (before && before !== pull.head.sha) reportPush(ctx, repo, pull, before);
    }
  }
  // Closed PRs drop out here, so the map holds only what is open.
  ctx.state.pullHeads![repo] = {
    etag,
    heads: Object.fromEntries(pulls.map((p) => [p.number, p.head.sha])),
  };
}

/** Reports a moved head as the `synchronize` event the stream would have carried. */
function reportPush(ctx: PollContext, repo: string, pull: any, before: string): void {
  const event: PullRequestEvent = {
    type: "PullRequestEvent",
    action: "synchronize",
    repo,
    actor: pull.user?.login ?? "",
    timestamp: pull.updated_at,
    title: pull.title,
    state: pull.state,
    body: collapseWhitespace(pull.body),
    base: pull.base?.ref,
    head: pull.head?.ref,
    labels: (pull.labels ?? []).map((l: any) => l.name),
    draft: pull.draft ?? false,
    before,
    after: pull.head.sha,
    refs: {
      pr: {
        number: pull.number,
        title: pull.title,
        html_url: pull.html_url,
        api_url: pull.url,
        diff_url: pull.diff_url,
      },
    },
  };

  const filtered = applyFilters(event, ctx.user);
  if (filtered) {
    console.error(`[github-events] Filtered push to ${repo}#${pull.number}: ${filtered.reason}`);
    return;
  }
  ctx.onEvent(`push-${repo}#${pull.number}-${pull.head.sha}`, event);
}
