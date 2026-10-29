# pr: design

Why the pr plugin works the way it does. What it does is in the
[README](README.md).

## 1. The stages

```
   GitHub event
        │
        ▼
   ┌─────────┐   not interesting
   │ triage  │──────────────────▶ ignored
   └────┬────┘
        │ tracked as a pr item
        ▼
   ┌─────────┐   blocked, and nobody can act but you
   │ unblock │──────────────────▶ attention: who can act
   └────┬────┘
        │ milestone set, CI understood, premise still true
        ▼
   ┌─────────┐   design question
   │ review  │──────────────────▶ attention: decide
   └────┬────┘
        │ findings posted, item updated
        ▼
   ┌──────────┐
   │ attention│─────▶ you: merge, close, or answer
   └──────────┘
```

Each stage can end by handing the PR to the user instead of continuing.
That is the design: the workflow's job is to make sure what reaches the
user is worth their attention, not to reach a verdict.

| Stage | Who | Reads |
|---|---|---|
| Triage | watcher | `rules/pr-interest.md`, `rules/apicurio-prs.md` |
| Unblock | watcher sweep, or reviewer as step one | `processes/pr-preflight.md` |
| Review | reviewer | `processes/pr-review.md`, `pr-comment.md` |
| Re-review | reviewer | `processes/pr-rereview.md` |
| CI failure | reviewer | `processes/ci-investigation.md` |
| Attention | watcher | `processes/pr-attention.md` |
| The user's queue | the user, `/pr:queue` | |
| The user's review | the user, `/pr:checkout`, or with a reviewer session | |

The watcher and reviewer are separate sessions. The watcher never waits
on a review, and no reviewer needs to be running for events to be
recorded: work is posted to the crew and claimed when a reviewer is free.

## 2. Unblock is its own stage

Most PRs that sit are not waiting on review. In one sweep of Apicurio
Registry:

- **Four** were red only because a linked issue had no milestone. The
  author couldn't fix that, and nobody was watching.
- **Two** issues had been fixed incidentally by unrelated work since
  filing. One contributor spent days on a bug that no longer existed.
- Several were red from CI artefacts: a cancelled duplicate run in the
  rollup, a stale re-attempt outranking a real success.

None of that shows in a diff, and all of it is mechanical. So the checks
run before anyone reads code, and also as a sweep over every tracked PR,
because a blocked PR is usually not queued for review at all.

## 3. What is automatic

A review that requests changes is posted automatically only when it is
mechanical: every blocking finding reproduced, no design question, and
complexity at most moderate. Everything else waits as a draft on the
`pr` item, for the user to post with their verdict.

**Approval is never automatic**, even with nothing blocking. An
optional-only review doesn't wait for the author's answer before the
user approves; that answer decides when to merge.

**Taking a position on a design question** is the subtle one. A review
that finds one says a question exists and raises a `decide` item; it
doesn't argue a side. Publishing an opinion first would pre-empt the
decision that was the user's.

Reviews apply code's quality rules (Q, J, SC, A) and never its
preferences (P): one person's taste is no standard for someone else's
code. That is also why code sits below pr.

## 4. State

A `pr` item in fyi holds everything both sessions know: lifecycle, review
state, findings, what needs attention and why. The watcher owns
lifecycle and attention, and reviewers own the review fields: disjoint,
so concurrent updates can't lose each other.

**A `pr` item mirrors GitHub, so it can be wrong** in a way a task can't:
if the watcher was down, the item describes the PR as it was. Every read
reports such an item as stale, and whoever uses it re-reads the PR and
updates the item before relying on it.

## 5. The review comment

Six sections, in order, any of which may be empty: **Decision**,
`## Context`, `## Direction`, `## Required changes`, `## Optional
changes`, `## Checked`.

Two change sections, because the author's decision is binary: does this
block merge, or is it their call. Items carry IDs (`R1`, `O2`) assigned
once per PR and never renumbered, so a later review's reference still
means what it meant. The format is in `processes/pr-comment.md`.

## 6. The server

**Delivery.** A first start records where each repository's event stream
is and delivers nothing, so starting to watch doesn't replay the past.
After that the cursor (`~/.jay/pr/state.json`) makes each event arrive
once, including events from while the server was down, up to
`MAX_EVENT_AGE`. Conditional requests with ETags make an unchanged
stream free against the rate limit.

**Pushes come from heads, not the stream.** The repository event stream
rarely carries a `synchronize` for a push to a same-repository branch,
and never for a fork, whose pushes happen in the fork: on 26 Oct, three
pushes to tracked PRs arrived with none, and no re-review was posted.
So each round also reads the watched repositories' open PRs, most
recently updated first, and reports a `synchronize`, with `before` and
`after`, for each head that moved. Any change to a PR puts it on the
first page, so an unchanged first page is a free 304 and the rest is
never read. The stream's own `synchronize` events are dropped, so a push
arrives once.

**Polling starts on demand.** Every session with the plugin runs its own
server, and before this each one polled all the watched repositories on
its own: rate limit spent several times over, and every event pushed
into sessions with no use for it. Now nothing calls GitHub until a
session calls `get_status` or `get_new_events`, which only a watching
session does. The first such call waits until the user and repositories
are known, so a status asked for then is complete. So one launch command
serves every session.

**Push and poll at once.** Events are pushed as channel notifications
and also kept for `get_new_events`, which tracks what it handed out
separately. A session can use either, or both, without double
processing.

**The hello.** Claude Code never declares the `claude/channel`
capability, so the server can't tell whether its pushes arrive. After
the first tool call it pushes `{"github":"hello"}`; a session that
receives it knows pushes reach it and stops polling. Without channels
Claude Code drops the hello, and polling continues, which is always
safe. crew does the same after `crew_join`.

**Adaptive polling.** `get_new_events` returns `{events,
next_poll_minutes}`: the interval grows while nothing arrives and resets
when something does, as crew's does, from the same shared code
(`tools/plugin/polling/`).

**Truncation.** Pushes and `get_new_events` carry bodies cut to 200
characters, because a session reads many events and acts on few;
`get_event` returns one in full.

**Filters.** Label churn on a PR collapses into one `labels-changed`
event. Ignored actors (a project bot) are dropped unless the event
mentions the user.

## 7. Settings

The user's handle and the repositories to watch are the user's, so they
are in `~/.jay/config.json`, shared with other jay plugins and written by
`setup.sh`. Before, the handle was in a config file in the repository
and the repositories in the MCP configuration the installer wrote, so a
second user would have had to edit both. Environment variables still
win, so tests need no file.

What is the project's (lifecycle labels, maintainer-only labels, where
reviewer assignment is declared) is a rule in the plugin,
`rules/apicurio-prs.md`, alongside code's `apicurio.md`.

## 8. Apicurio-specific, for now

The PR processes assume Apicurio's conventions: reviewers assigned
automatically, `lifecycle/*` labels, a bot account to ignore
(`filters.ts`). The first users work on Apicurio, so that is the right
default. Making it configurable waits for users outside it, and ties in
with a facility to load and switch rules by ID.

## 9. Not done

- Preparing small fixes for PRs that have waited long, for the user to
  push and approve in one step.
- A fine-grained, read-only token for the server.
