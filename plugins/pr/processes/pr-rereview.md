# PR Re-review

Reviewing a pull request that has moved since it was last reviewed.
Read instead of a first review, alongside `~/.jay/plugins/pr/processes/pr-review.md`.

## Start

The `pr` item shows `auto_review: needs-re-review` — set by the watcher
on a push, or when the author replies to review comments.

Only re-review what is ours: assigned to the user, or they are a
requested reviewer. Otherwise just note the new commits on the item.

## Scope

New commits only. Do not re-raise findings already posted, and do not
re-raise ones dropped on purpose — the author will read it as the
review going backwards.

Ids continue the existing sequence. A finding raised now is the next
free `R` or `O`; earlier ids keep meaning what they meant.

## Did they address the last round?

Check each prior finding explicitly — the user's own comments, and any
optional finding the author chose to address here (`followups`) — and
set `author_response`:

| | |
|---|---|
| `addressed` | Everything resolved |
| `partially-addressed` | Some outstanding — say which in the Decision |
| `not-addressed` | Nothing acted on |

## Say what changed, not everything

The comment leads with what was addressed, then lists what remains and
what is new. Never restate the whole review; the author should not have
to diff two comments to find out where they stand.

Post or draft per `~/.jay/plugins/pr/processes/pr-comment.md`, as for a first review.

## Reopening something you closed

Before posting a required finding, check whether a previous review
closed the matter — "nothing further from my side", "no further issues
found". If it did, acknowledge the reversal plainly: *in my earlier
review I said this was resolved; on re-reading the current head I am
raising something I should have caught then.*

Three cases where reopening needs no apology, because the ground moved:

1. **The latest push introduced a regression** — name it and the commit.
2. **A major refactor or scope expansion** — quote the delta.
3. **A squash or force-push dropped a fix** — say which one.

Silently reopening a closed point is what makes a review feel arbitrary.

## Attention

Set `author_response` accurately and leave `attention` to the watcher.
When the user asked for changes and the author has addressed them, the
watcher puts the PR back in front of the user (`~/.jay/plugins/pr/processes/pr-attention.md`).
