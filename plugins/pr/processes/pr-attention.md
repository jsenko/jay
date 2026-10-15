# Attention State Machine

When `attention` should be `true` or `false` on a `pr` item. **Only the
watcher sets it**; other sessions change the fields it is derived from
and tell the watcher.

## Start

Whenever `manual_review`, `auto_review`, `author_response` or
`check_status` changes. The events that change them — pushes, comments,
CI — are handled in `~/.jay/plugins/pr/processes/pr-events.md`, which then comes here.

## Core table

| `manual_review` | `auto_review` | `attention` | Reason |
|---|---|---|---|
| `pending` | `needs-review` | `false` | Automated review has not started |
| `pending` | `in-progress` | `false` | Review in progress |
| `pending` | `reviewed`, no required findings | `true` | Ready for manual sign-off |
| `pending` | `reviewed`, required findings | `true` | Required findings need the user's decision |
| `pending` | `needs-re-review` | `false` | Waiting for the re-review |
| `approved` | any | `false` | Already approved |
| `changes-requested` | `needs-re-review` | `false` | Waiting for the author, then a re-review |
| `changes-requested` | `reviewed` + `author_response: addressed` | `true` | Author addressed it; the user re-checks |
| `changes-requested` | `reviewed` + `author_response: not-addressed` | `false` | Still the author's turn |
| `changes-requested` | `reviewed` + `author_response: partially-addressed` | `true` | Partial; the user decides the next step |
| `commented` | `reviewed` | `true` | Commented without approving or requesting changes |
| `commented` | `needs-re-review` | `false` | Waiting for the re-review |

## Overrides

Always `attention: true`, whatever the table says:

- the user is @mentioned on the PR
- `check_status: needs-approval`
- a `merge` attention item that is the user's move (`who: user`)
- a `respond` attention item from a direct question
- a `decide` attention item

## Reviewer completes a review or re-review

**Source:** crew job resolved by the reviewer → watcher
**Processed by:** watcher

1. Re-read the `pr` item. The reviewer has already set `auto_review`,
   `auto_reviewed_commit`, `findings`, `complexity` and `author_response`.
2. Set `attention` from the core table.
3. If `manual_review: changes-requested` and `author_response:
   addressed`: reset `manual_review: pending`, set `attention: true`, add
   a `manual-review` item — "Author addressed feedback, ready for
   sign-off".

## User completes a manual review

**Source:** (1) `crew_send` from `/pr:checkout` → watcher;
(2) GitHub `PullRequestReviewEvent` via `github-events` → watcher, as the
fallback
**Processed by:** watcher, on whichever arrives first

1. `manual_review` not yet set for this head — the user reviewed on
   GitHub directly → set it and `manual_reviewed_commit` to HEAD, and
   clear the `manual-review` item.
2. Set `attention` from the core table.
3. The second signal finds nothing to do. Both arrive whenever
   `/pr:checkout` was used, so this is normal, not a duplicate to
   report.

## Resetting `manual_review`

Back to `pending` only when the author has pushed **and** a re-review
has confirmed `author_response: addressed`. Not while the re-review is
pending, and not on `not-addressed` or `partially-addressed`.
