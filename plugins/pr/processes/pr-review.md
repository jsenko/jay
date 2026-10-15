# PR Review

Reviewing a pull request. Read when starting one.

Conduct rules that always apply: `~/.jay/plugins/pr/rules/pr-conduct.md`. Writing the
comment: `~/.jay/plugins/pr/processes/pr-comment.md`. Re-reviews: `~/.jay/plugins/pr/processes/pr-rereview.md`.

## Start

A review job claimed from the crew, or the user asking directly.

## Is this ours to review?

| PR | Do |
|---|---|
| Assigned to the user, or they are a requested reviewer | Review, and re-review |
| From a team member | Review once; re-review at lower priority |
| Not theirs, already reviewed by another team member | Do not pile on. Only if asked, or if the user is mentioned |
| The user already reviewed this head | Record anything new on the item; post nothing |

Update the `pr` item either way: a summary is worth having without a comment.

## 1. Preflight

`~/.jay/plugins/pr/processes/pr-preflight.md`, before reading any code. A review of a PR
whose premise is already fixed is wasted entirely.

## 2. Check out the branch

Refuse on a dirty tree. For a fork (`isCrossRepository: true`), add
the remote, fetch and branch from it; otherwise `gh pr checkout`. Return
to the default branch afterwards, even on failure.

## 3. Gather

Metadata, labels, files, commits, the linked issues, and every existing
review comment — human and automated.

## 4. Analyse

What it solves, whether the approach fits the codebase, its blast
radius, and whether anything about it touches security.

Read around the change: callers, siblings, the components it affects.

**Compare the issue with the PR.** Requirements the issue states and the
PR does not meet are findings. An approach that silently differs from
what the issue describes is a finding — ask whether the deviation was
intended. Scope beyond the issue is worth noting but is not a fault
unless it adds risk. Things the implementer discovered along the way are
expected, not gaps.

## 5. Review the code

Apply code's rules, citing their IDs: `~/.jay/plugins/code/rules/quality.md`
and what it points to (Q, J, SC), and `apicurio.md` there (A) in Apicurio
and Apitomy repositories. Never `preferences.md`: one person's taste is
no standard for someone else's code.

Two severities, because the author's decision is binary:

| | |
|---|---|
| **Required** | Blocks merge: correctness, security, data loss, and test assertions weakened without justification |
| **Optional** | Everything else, however strongly recommended |

Be sparing with required. A relaxed test assertion — `assertEquals`
becoming `contains`, an assertion removed, matching made lenient — is
required until the author names the field that changed and why the
difference is safe; relaxations hide serialisation and equality
regressions.

In a module with a history of the same bug class, an edge case is
required rather than optional. The history is evidence that "cannot
happen" does.

**Verify rather than reason**, per `~/.jay/plugins/pr/rules/pr-conduct.md`. Running the
PR's own tests takes two minutes and makes the review concrete.

## 6. Consolidate

Check what Copilot and other automated reviewers already said. Do not
restate their findings; note what is already covered.

## 7. Post or draft

`~/.jay/plugins/pr/processes/pr-comment.md` decides which, and the format.

## 8. Update the item

`auto_review: reviewed`, `auto_reviewed_commit` at the reviewed SHA,
`reviewed_at`, `findings` as `required/optional`, `complexity`, a
`summary` of what the user must decide (other maintainers' reviews go
here: `manual_review` is the user's own), and `draft_review` if not
posted. Clear the `review` item; the watcher sets `attention` on resolve.

## Modes

**Claimed from the crew** — do not ask; the user approved it when it was
posted. Post or draft per `~/.jay/plugins/pr/processes/pr-comment.md`, then `crew_resolve`
saying which.

**Asked for directly** — the user is present. Show the findings before
posting; they accept, drop, reword or add. Only post what they accept.
Reviewing drafts changes conclusions often enough to be worth the round
trip.

Once they approve a *class* of action, that carries — no need to ask
again for the next one of the same kind. Mechanical actions (setting a
milestone, a one-line pointer comment, an assignment) need no approval at
all.

## Priorities

Correctness, then security, then API compatibility, then tests, then
error handling, then design fit, then user experience, then style.

On tests, prefer one that exercises the real path end to end over a unit
test of a helper the end-to-end test already covers. Ask for the missing
**failure** paths rather than more happy-path coverage.
