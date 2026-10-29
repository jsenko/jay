# PR Preflight

Checks that run before anyone reads a diff. Two callers, one process:
the reviewer as its first step, and the watcher as a periodic sweep over
every tracked PR.

Worth its own pass because most blocked PRs are not queued for review —
they are simply sitting, red, for reasons nobody is watching.

## Start

Before reviewing, and on a watcher sweep.

## 1. Is our record current?

A `pr` item mirrors GitHub, so it can be *wrong* rather than merely old.
`fyi_get` and `fyi_search` say `stale` when it has not been confirmed
recently — usually because no watcher was running.

Re-read the PR, `fyi_update` with `synced: true`, and work from that. Do
not reason from a stale item: in one sweep, 49 of 129 tracking files
claimed a PR was active weeks after it closed.

## 2. Is the premise still true?

For any PR or issue older than about a week, **reproduce before
reviewing**. The tree moves: issues get fixed incidentally by unrelated
work, and nobody notices.

A stale premise wastes the contributor's time before it wastes yours —
one contributor spent days on a bug that no longer existed.

If it is fixed: say so on the issue and the PR, and stop. That is the
whole review.

## 3. Milestone gate

Needs an open milestone on the PR and on every **open** issue it closes.
A closed milestone fails like a missing one; a closed linked *issue* is
not checked at all, since its milestone records when its work shipped.

Still the most common blocker the author cannot fix. Set it per
`~/.jay/plugins/pr/processes/pr-milestone.md` — mechanical, no approval needed, and
setting it now re-runs the validation on its own (#10386). No manual
re-run, and no need to tell the author anything.

## 4. Is the red actually red?

Before treating a failing rollup as the PR's problem, check
`~/.jay/plugins/pr/rules/github-gotchas.md`. Duplicate runs, stale re-attempts and
`pull_request_target` all produce red that has nothing to do with the
code.

## 5. DCO

Merge commits are exempt, so a failure means genuinely unsigned work
commits. `git rebase --signoff upstream/main` fixes them.

Do not repeat the old merge-commit advice — it was right before the
exemption and is now a wrong turn.

## 6. Who can act?

Record what is blocking as an attention item whose `who` names **who
can unblock it** — `user`, `author` or `maintainer`. An item that does
not say leaves everyone assuming someone else is handling it.

The PR Validation comment now does this itself, grouping requirements
under "For the author" and "For a maintainer" with a status per
requirement (#10386). Read it rather than working the same thing out
from the check rollup.

## 7. A bot PR left waiting

On a watcher sweep only. The project's rule names the authors it
auto-accepts; their PRs get no review job at triage, as CI approves
them. One still open 24 hours after `opened_at` was not: post the review
job triage would have posted, once.

## Result

Either the PR is unblocked and review can proceed, or there is an
attention item saying what is blocking and whose move it is.
