/**
 * The open PRs in the watched repositories that involve the user
 * directly: authored, assigned, or asking for their review.
 *
 * Read from each repository's pull list rather than from search. The
 * search index can be wrong for a while, once answering 0 for
 * `assignee:` while 26 PRs were assigned, and a reconcile that trusts it
 * never triages what was assigned meanwhile.
 */

import { API, githubHeaders } from "./github.js";

/** Why a PR involves the user. */
export type Involvement = "author" | "assignee" | "review-requested";

/** One PR, and why it is listed. */
export interface InvolvedPr {
  url: string;
  repo: string;
  number: number;
  title: string;
  author: string;
  involves: Involvement[];
}

/** What a scan found, and the repositories it could not read. */
export interface InvolvedPrs {
  prs: InvolvedPr[];
  failed: string[];
}

/** Repositories read at once: enough to be quick, few enough to be polite. */
const CONCURRENCY = 8;

/** Lists every open PR of one repository, page by page. */
async function openPulls(repo: string, token: string): Promise<any[]> {
  const pulls: any[] = [];
  for (let page = 1; ; page++) {
    const res = await fetch(`${API}/repos/${repo}/pulls?state=open&per_page=100&page=${page}`, {
      headers: githubHeaders(token),
    });
    if (!res.ok) throw new Error(`${repo}: ${res.status}`);
    const batch: any[] = await res.json();
    pulls.push(...batch);
    if (batch.length < 100) return pulls;
  }
}

/** Why one pull involves `user`, if it does. Logins compare without case, as GitHub's do. */
function involvement(pull: any, user: string): Involvement[] {
  const is = (login: string | undefined) => login?.toLowerCase() === user.toLowerCase();
  const out: Involvement[] = [];
  if (is(pull.user?.login)) out.push("author");
  if ((pull.assignees ?? []).some((a: any) => is(a.login))) out.push("assignee");
  if ((pull.requested_reviewers ?? []).some((r: any) => is(r.login))) out.push("review-requested");
  return out;
}

/**
 * Scans `repos` for PRs involving `user`. A repository that can't be
 * read is reported in `failed`, not dropped silently, so the caller
 * knows the list is incomplete.
 */
export async function involvedPrs(repos: string[], user: string, token: string): Promise<InvolvedPrs> {
  const result: InvolvedPrs = { prs: [], failed: [] };
  const queue = [...repos];

  const worker = async () => {
    for (let repo = queue.shift(); repo; repo = queue.shift()) {
      try {
        for (const pull of await openPulls(repo, token)) {
          const involves = involvement(pull, user);
          if (involves.length === 0) continue;
          result.prs.push({ url: pull.html_url, repo, number: pull.number, title: pull.title, author: pull.user?.login, involves });
        }
      } catch (err: any) {
        console.error(`[github-events] Listing pulls failed: ${err.stack ?? err}`);
        result.failed.push(repo);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, repos.length) }, worker));

  result.prs.sort((a, b) => a.repo.localeCompare(b.repo) || a.number - b.number);
  return result;
}
