# PR Reconcile

Bringing the tracked `pr` items back in line with GitHub, and posting the
work that should exist but does not. Run by the watcher.

## Start

**Source:** watcher startup → watcher, every time; or `get_status`
showing a gap in `coverage.oldestBufferedEvent` mid-session
**Processed by:** watcher

## 1. What GitHub says involves the user

`get_involved_prs` lists the open PRs the user authored, is assigned or
is asked to review, read live from every watched repository. A
repository in its `failed` is unknown this run: leave its tracked items
as they are.

Mentions and comments come only from search, for each watched entry
(`owner/*` is `--owner <owner>`):

```bash
gh search prs --state open --repo <owner/repo> --involves @me --json url,number,title
```

The search index can lag, so an empty answer proves nothing. Prefix with
`GH_HOST=github.com` only when `gh auth status` lists another host;
without it, the allow rules for `gh` still match.

## 2. Compare with what is tracked

Open tracked items: `fyi_search({type: ["pr"], where: {lifecycle:
["ready-for-review", "ready-to-merge"]}})`.

| On GitHub | In fyi | Then |
|---|---|---|
| Open, and `~/.jay/plugins/pr/rules/pr-interest.md` says track | Untracked | Triage, per `~/.jay/plugins/pr/processes/pr-events.md` |
| Open | Tracked | Refresh, below |
| In neither list | Tracked | `gh pr view <url>`: merged or closed → Close, per `~/.jay/plugins/pr/processes/pr-events.md`; still open → refresh |

## 3. Refresh a tracked PR

```bash
gh pr view <url> --json headRefOid,state,labels,milestone,reviews
```

and `get_check_status({url, gates})`, with the gates
`~/.jay/plugins/pr/rules/apicurio-prs.md` names, rather than reading the
checks by hand.

Then handle whatever moved as the event would have been handled, per
`~/.jay/plugins/pr/processes/pr-events.md`:

| Found | Handle as |
|---|---|
| Head differs from `auto_reviewed_commit`, and it was reviewed | Push |
| A review by the user not in `manual_review` | Review |
| Lifecycle labels differ from `lifecycle` | Labels |
| `get_check_status` differs from `check_status` | CI |

Give every attention item that lacks `who` one, read from its
description — "Author move: rebase" is `author`, "Decision owed by Eric"
is `maintainer`. Replace it with `remove` then `add` in one call.

Finish with `fyi_update` and `synced: true`. Change attention items with
`add` and `remove`, never by setting the list — other sessions' entries
must survive a resync.

## 4. Post the work that is missing

`crew_poll({board: true})` lists every outstanding job. For each item
with `auto_review` of `needs-review` or `needs-re-review` and no
outstanding job for its PR, post one as triage or push would have —
the same conditions, including skipping a head the user already
reviewed. Space them out; a reviewer that claims five at once finishes
none of them.

## 5. Attention

Set `attention` on every item touched, per `~/.jay/plugins/pr/processes/pr-attention.md`.

## Result

One line in the startup report: tracked, refreshed, closed, jobs
posted, and whether they wait for a reviewer (`routable: false`).
Nothing more: the dashboard has the detail.

## Notes

Every startup, not only after a detected gap. `github-events` drops
events older than `MAX_EVENT_AGE` (a day by default), so after a day
off the missed events are never delivered at all, and nothing else
would notice a PR assigned while the watcher was down.
