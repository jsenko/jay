# PR Event Handling

How the watcher turns GitHub activity into `pr` item state and crew jobs.
Field names come from the `fyi` tool descriptions; attention rules from
`~/.jay/plugins/pr/processes/pr-attention.md`; what is worth tracking from
`~/.jay/plugins/pr/rules/pr-interest.md`. Run `~/.jay/plugins/pr/processes/pr-preflight.md` as a sweep over
tracked PRs — most blocked ones are never queued for review.

## Start

On each event from the `github-events` MCP server. Silent when nothing
is actionable — say nothing rather than reporting that there was nothing.

## Routing

| Event | Then |
|---|---|
| Not PR-related | Important? Capture a task or note. Otherwise skip — an event not worth either is reconstructible from GitHub. |
| PR-related, untracked | Triage below |
| `PullRequestEvent` synchronize | Push |
| `PullRequestEvent` closed | Close |
| `PullRequestEvent` other, incl. collapsed `labels-changed` | Labels |
| `PullRequestReviewEvent` | Review |
| `IssueCommentEvent` | Comment |
| `WorkflowRunEvent` | CI |

PR-related means `PullRequestEvent`, `PullRequestReviewEvent`,
`PullRequestReviewCommentEvent`, `IssueCommentEvent` with
`is_pull_request`, or `WorkflowRunEvent` with `refs.pr`. The MCP server
collapses rapid label churn into one event carrying the final labels.

Find the item with `fyi_search({type: ["pr"], where: {repo, number}})`;
none means untracked.

## Triage

1. Evaluate against `~/.jay/plugins/pr/rules/pr-interest.md`. Assigned to the user, or one
   of its exceptions → track. Otherwise do not.
2. `fyi_capture` a `pr` item: `url`, title, author, assignee,
   importance, `complexity` from the diff size, `triage_reason`,
   `lifecycle: ready-for-review`, `auto_review: needs-review`,
   `manual_review: pending`, attention items.
   If the user already reviewed the current head on GitHub, record that
   verdict as `manual_review` and the head as `manual_reviewed_commit`.
3. Assign a milestone per `~/.jay/plugins/pr/processes/pr-milestone.md`.
4. `crew_post` a review job when assigned to the user, or importance is
   critical or high, and lifecycle is `ready-for-review` — **not when the
   user already reviewed the current head**. Otherwise leave it: the
   dashboard surfaces it without a session being asked.

## Push

New commits arrived, so any prior review is stale.

1. `auto_review: needs-re-review`, `attention: false`
2. Clear `review` and `re-review` attention items
3. `crew_post` a re-review job, `prefer` the session that reviewed it
   last. When `manual_review` is `changes-requested`, include the user's
   comments and ask the reviewer to set `author_response`.
4. `routable: false` → add a `re-review` attention item, per Errors

## Labels

| Label | Sets |
|---|---|
| `lifecycle/ready-for-review` | `lifecycle: ready-for-review` |
| `lifecycle/ready-to-merge` | `lifecycle: ready-to-merge`, add `merge` item |
| `waiting-on-maintainer` added | add `respond` item |
| `waiting-on-author` removed, and `auto_review: reviewed` | `needs-re-review`, post a re-review job |
| `stale` added | add `stale` item |

`lifecycle/tested` and `lifecycle/full-verified` are CI signals, not
lifecycle states — note them, do not set `lifecycle` from them.

## Close

Set `lifecycle` to `merged` or `closed`, clear attention items and
`attention`. If merged, assign a milestone per
`~/.jay/plugins/pr/processes/pr-milestone.md`. The item archives itself seven days later.

## Review

| Reviewer | Then |
|---|---|
| The user, via `/pr:checkout` | Already recorded; set `attention` per `~/.jay/plugins/pr/processes/pr-attention.md` |
| The user, directly on GitHub | Set `manual_review` to the action and `manual_reviewed_commit` to HEAD, clear the `manual-review` item, recalculate attention |
| Someone else, approved | Note it |
| Someone else, changes requested | Add a `respond` item naming them |

## Comment

| Comment | Then |
|---|---|
| Mentions the user | Add a `respond` item, set `attention: true` |
| From the author, when `auto_review: reviewed` and review comments exist | `needs-re-review`, post a re-review job, `attention: false` |
| From the author, choosing per optional finding ("O1 here, O2 issue") | Record `followups`. Each `issue`: `crew_post` a job to file it, `prefer` the session that reviewed it. Each `here`: wait for the push |
| Says the contributor is blocked on this PR landing | Raise importance one level. Not for comments that merely ask for attention. |

## CI

| Conclusion | Then |
|---|---|
| failure, user is author | `check_status: failing`, add `ci-failing` |
| failure, others | `check_status: failing`, add `ci-investigate`, post an investigation job — `~/.jay/plugins/pr/processes/ci-investigation.md` |
| success | `check_status: passing`, clear both, recheck attention |
| action_required | `check_status: needs-approval`, add `ci-approve`, `attention: true` |

## Errors

A failed write is logged and skipped, not retried into a loop. A job
posted with `routable: false` waits for a reviewer: never re-post it, and
begin `activity` with "review queue stalled" until one is claimed. On
GitHub API failures, act on what is known and say it is uncertain.

## Notes

The watcher owns `lifecycle` and the `attention` flag. Reviewers own
`auto_review`, `findings`, `complexity`, `author_response`, `summary` and
`draft_review`; `/pr:checkout` owns `manual_review`. Any of them may
add or clear attention items about its own work.
