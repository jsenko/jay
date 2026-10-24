/**
 * A PR's `check_status`, derived the same way every time.
 *
 * Reading `statusCheckRollup` by hand went wrong twice in one day: the
 * rollup keeps superseded runs, so PRs looked failing on a failure a
 * later run had replaced; and fork runs held for approval aren't in it
 * at all, so `ci-approve` was cleared on PRs that still needed it.
 */

import { API, githubHeaders } from "./github.js";

/** The values of a `pr` item's `check_status`. */
export type CheckStatus = "passing" | "failing" | "pending" | "needs-approval";

/** The derived status, and the checks behind it. */
export interface CheckReport {
  check_status: CheckStatus;
  head: string;
  failing: string[];
  pending: string[];
  /** Workflow runs on the head waiting for a maintainer to approve them. */
  awaiting_approval: string[];
}

/** One check's latest outcome, from a check run or a commit status. */
type Outcome = "success" | "failure" | "pending" | "ignored";

/** Fetches an API path as JSON, failing loudly, since a guess here clears real attention items. */
async function get(path: string, token: string): Promise<any> {
  const res = await fetch(`${API}${path}`, { headers: githubHeaders(token) });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

/** A check run's outcome. Skipped and neutral runs say nothing about the PR. */
function runOutcome(run: any): Outcome {
  if (run.status !== "completed") return "pending";
  if (run.conclusion === "success") return "success";
  if (run.conclusion === "skipped" || run.conclusion === "neutral") return "ignored";
  return "failure";
}

/** A commit status's outcome; GitHub already gives only the latest per context. */
function statusOutcome(status: any): Outcome {
  if (status.state === "success") return "success";
  if (status.state === "pending") return "pending";
  return "failure";
}

/**
 * The latest run of each check name. A re-run supersedes the run before
 * it, which the rollup would otherwise still show.
 */
function latestByName(runs: any[]): Map<string, any> {
  // A run queued but not started has no start yet, and is the newest.
  const started = (run: any) => Date.parse(run.started_at) || Infinity;
  const latest = new Map<string, any>();
  for (const run of runs) {
    const seen = latest.get(run.name);
    if (!seen || started(run) > started(seen) || (started(run) === started(seen) && run.id > seen.id)) {
      latest.set(run.name, run);
    }
  }
  return latest;
}

/** Every check run on a commit, page by page. */
async function checkRuns(repo: string, sha: string, token: string): Promise<any[]> {
  const runs: any[] = [];
  for (let page = 1; ; page++) {
    const batch = (await get(`/repos/${repo}/commits/${sha}/check-runs?per_page=100&page=${page}`, token)).check_runs;
    runs.push(...batch);
    if (batch.length < 100) return runs;
  }
}

/**
 * Derives the status of PR `number` in `repo`. `gates` names checks that
 * stay pending until someone runs them on demand: a project rule lists
 * them, and their failure reads as pending, not failing.
 */
export async function checkStatus(repo: string, number: number, gates: string[], token: string): Promise<CheckReport> {
  const head: string = (await get(`/repos/${repo}/pulls/${number}`, token)).head.sha;
  const [runs, combined, held] = await Promise.all([
    checkRuns(repo, head, token),
    get(`/repos/${repo}/commits/${head}/status`, token),
    get(`/repos/${repo}/actions/runs?head_sha=${head}&status=action_required&per_page=100`, token),
  ]);

  const outcomes = new Map<string, Outcome>();
  for (const [name, run] of latestByName(runs)) outcomes.set(name, runOutcome(run));
  for (const status of combined.statuses ?? []) outcomes.set(status.context, statusOutcome(status));

  const report: CheckReport = {
    check_status: "passing",
    head,
    failing: [],
    pending: [],
    awaiting_approval: (held.workflow_runs ?? []).map((run: any) => run.name),
  };
  for (const [name, outcome] of outcomes) {
    if (outcome === "failure" && !gates.includes(name)) report.failing.push(name);
    else if (outcome === "pending" || outcome === "failure") report.pending.push(name);
  }

  if (report.failing.length > 0) report.check_status = "failing";
  else if (report.awaiting_approval.length > 0) report.check_status = "needs-approval";
  else if (report.pending.length > 0 || outcomes.size === 0) report.check_status = "pending";
  return report;
}
