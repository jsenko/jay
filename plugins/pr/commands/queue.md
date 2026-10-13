---
description: Gather a prioritised batch of PRs waiting on the user
argument-hint: [how many, default 5]
---

# Overview

Build a short queue of pull requests that need the user, ordered so the
cheapest and the most overdue come first. Then hand them over one at a
time to `/pr:checkout`.

Use this when the question is "what should I work through now?".
`/pr:checkout` is for when the PR is already chosen.

# Process

## 1. Gather

`fyi_search({type: ["pr"], where: {attention: true}})`.

**Refresh anything marked `stale` before ordering it.** A `pr` item
mirrors GitHub, so a stale one may be describing a PR that merged last
week — and ordering a batch around it wastes the whole session. Re-read
it and `fyi_update` with `synced: true`.

## 2. Order

Two things jump the queue, for different reasons.

**Quick wins** — a few minutes each, and clearing them shortens the list
faster than anything else:

- `auto_review: reviewed`, no required findings outstanding, and
  `author_response: addressed` — it needs a signature, not a review
- `complexity: trivial` or `simple`, with `check_status: passing`
- a single `respond` item that is a question, not a change

**Waiting longest** — measured from `opened_at`. Age is what a
contributor feels, and a PR nobody has touched in three weeks costs
goodwill that a well-reviewed one does not.

Then everything else by importance.

Mixing the two deliberately: all quick wins first is satisfying but
leaves the oldest PRs ageing, and strict age order starts the session
with the hardest thing in the queue.

## 3. Present

One line each. Enough to pick, not to review:

```
1. #8676  needs sign-off      2d   kafkasql retry — reviewed, author addressed everything
2. #8401  waiting 24d         24d  operator RBAC — never reviewed, 3 files
3. #8702  question            5d   asks whether the config name is right
```

Say what the batch leaves out, and how much: *11 more waiting, 6 of them
over two weeks.* A queue that hides its own length invites the user to
think they are done.

## 4. Work through it

Start the first with `/pr:checkout <number>`. When that one closes,
offer the next and say what remains.

Re-gather rather than trusting the list if the session has been going a
while — the board moves.

# Notes

The batch size defaults to five because the point is finishing it.
`~/.jay/plugins/crew/rules/always.md` says to bring what the user can actually act on, and a
queue of twenty is the same as no queue.

Ordering lives here, not in `fyi`. What counts as a quick win blends
several fields and will want tuning with use; `fyi` holds state, and
this is policy.
