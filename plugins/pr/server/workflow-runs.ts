/** Polling GitHub Actions runs: failures to look into, and runs waiting for approval. */

import type { PollContext } from "./context.js";
import type { NumberedRef, WorkflowRunEvent } from "./event-types.js";
import { API, fetchGitHubApi, githubHeaders, htmlUrlFromApiUrl } from "./github.js";

/** Polls every watched repository's workflow runs, recording one health result for all. */
export async function pollWorkflowRuns(ctx: PollContext): Promise<void> {
  if (!ctx.state.workflowRuns) {
    ctx.state.workflowRuns = {};
  }

  let hadError = false;
  for (const repo of ctx.repos) {
    try {
      await pollWorkflowRunsForRepo(ctx, repo);
    } catch (err) {
      const msg = `Error polling workflow runs for ${repo}: ${err}`;
      console.error(`[github-events] ${msg}`);
      ctx.health.error("workflow_runs", msg);
      hadError = true;
    }
  }
  if (!hadError) {
    ctx.health.success("workflow_runs");
  }
}

/**
 * Completed runs since the last poll, and runs waiting for a maintainer
 * to approve them (first-time contributors). On a first run they only set
 * the cursor.
 */
async function pollWorkflowRunsForRepo(ctx: PollContext, repo: string): Promise<void> {
  const runState = ctx.state.workflowRuns![repo];
  const isFirstRun = !runState;

  const since = runState?.lastPollAt
    ?? new Date(Date.now() - ctx.config.maxEventAgeHours * 3600_000).toISOString();
  const sinceDate = since.slice(0, 10);

  // Fetch completed runs (success + failure)
  const completedUrl = `${API}/repos/${repo}/actions/runs?status=completed&per_page=30&created=>${sinceDate}`;
  // Fetch runs awaiting approval (first-time contributor workflows)
  const waitingUrl = `${API}/repos/${repo}/actions/runs?status=action_required&per_page=10`;

  const [completedRes, waitingRes] = await Promise.all([
    fetch(completedUrl, { headers: githubHeaders(ctx.config.githubToken) }),
    fetch(waitingUrl, { headers: githubHeaders(ctx.config.githubToken) }),
  ]);

  if (completedRes.status === 403 || completedRes.status === 429) {
    ctx.health.error("workflow_runs", `Rate limited polling workflow runs for ${repo}`);
    return;
  }
  if (!completedRes.ok) {
    const msg = `Error polling workflow runs for ${repo}: ${completedRes.status}`;
    console.error(`[github-events] ${msg}`);
    ctx.health.error("workflow_runs", msg);
    return;
  }

  const completedData: any = await completedRes.json();
  const waitingData: any = waitingRes.ok ? await waitingRes.json() : { workflow_runs: [] };
  const runs: any[] = [
    ...(completedData.workflow_runs ?? []),
    ...(waitingData.workflow_runs ?? []).map((r: any) => ({ ...r, conclusion: "action_required" })),
  ];

  let maxRunId = runState?.lastRunId ?? 0;

  for (const run of runs) {
    if (run.id <= (runState?.lastRunId ?? 0)) continue;
    if (run.id > maxRunId) maxRunId = run.id;
    if (isFirstRun) continue;

    const formatted = await formatWorkflowRun(ctx, run, repo);
    if (!formatted) continue;

    const eventId = `wfrun-${run.id}`;
    ctx.cache.setEvent(eventId, formatted);
    ctx.onEvent(eventId, formatted);
  }

  ctx.state.workflowRuns![repo] = {
    lastRunId: maxRunId,
    lastPollAt: new Date().toISOString(),
  };
}

/** A workflow run as a session sees it, with its PR when a PR triggered it. */
async function formatWorkflowRun(ctx: PollContext, run: any, repo: string): Promise<WorkflowRunEvent | null> {
  const triggerEvent: string = run.event ?? "unknown";
  let prRef: NumberedRef | undefined;

  if (triggerEvent === "pull_request" || triggerEvent === "pull_request_target") {
    if (run.pull_requests?.length > 0) {
      const prData = run.pull_requests[0];
      const prUrl: string = prData.url;
      const fullPr = await fetchGitHubApi(prUrl, ctx.config.githubToken, ctx.cache);

      if (fullPr) {
        prRef = {
          number: fullPr.number ?? prData.number,
          title: fullPr.title ?? "",
          html_url: fullPr.html_url ?? htmlUrlFromApiUrl(prUrl),
          api_url: prUrl,
        };
      }
    }
  }

  return {
    type: "WorkflowRunEvent",
    repo,
    actor: run.actor?.login ?? "unknown",
    timestamp: run.updated_at ?? run.created_at,
    action: "completed",
    body: `Workflow "${run.name ?? run.display_title}" ${run.conclusion} on ${triggerEvent} (branch: ${run.head_branch})`,
    workflow_name: run.name ?? run.display_title ?? "unknown",
    conclusion: run.conclusion,
    trigger_event: triggerEvent,
    head_branch: run.head_branch ?? "",
    run_number: run.run_number,
    run_attempt: run.run_attempt,
    refs: {
      run: {
        html_url: run.html_url,
        api_url: `${API}/repos/${repo}/actions/runs/${run.id}`,
      },
      ...(prRef ? { pr: prRef } : {}),
    },
  };
}
