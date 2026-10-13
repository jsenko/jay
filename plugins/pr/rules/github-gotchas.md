# GitHub Automation Gotchas

Failure modes that produce no error. The symptom is a contributor
waiting, or a PR sitting red for reasons unrelated to its content.

Read when something looks wrong and the code does not explain it.

## Checks

- **A hand-added label during a skip-deciding Verify run.** The run is
  left alone, and a maintainer has to re-run it from the Actions UI.
  `/retry` is disabled on `orchestrator/disabled` PRs. The only
  remaining case of this class (#10301).
- **Bot labels do not trigger workflows.** Labels applied with
  `GITHUB_TOKEN` fire nothing, so only a label added by a person can
  disturb a run.
- **`/retry` is the remedy**, not `gh run rerun`. It re-runs a failed
  validation run and re-runs the Verify run when an approval makes the
  full suite required. A green or in-progress run is left alone.

### Fixed upstream, September 2026 — do not re-derive these

| Was | Now |
|---|---|
| Duplicate runs, the cancelled one surfacing red | One Verify run per commit; `Verification Gate` is a commit status replaced in place (#10307, #10344) |
| A stale re-attempt outranking a newer success | The newest run by `run_started_at` wins; a late finisher cannot overwrite it (#10307) |
| A label change cancelling the in-flight suite | `labeled`/`unlabeled` dropped from the triggers (#10301) |
| `/retry` not re-running `Validate PR` | It does (#10386) |
| Closing keywords matching in prose and code spans | Inline code and fenced blocks are stripped, CommonMark-compliant (#10386) |

## Issues and assignment

- **`gh issue edit --add-assignee` false-negatives.** It validates
  against `assignable_users`, which excludes commenters. `POST
  /issues/{n}/assignees` works and is correct.
- **Claim commands fire only on comment creation**, and must be first on
  the first line. Editing a comment to add one does nothing.
- **`gh pr edit` fails to label or set a milestone**, on the Projects
  (classic) deprecation. Use the issues API: `gh api -X POST
  repos/{o}/{r}/issues/{n}/labels -f 'labels[]=X'`.

## Milestones

The gate needs an *open* milestone on the PR and on every issue it
closes. A closed milestone reads as no milestone.

## DCO

**Merge commits are exempt**, so a PR whose only unsigned commits are
merges already passes. A DCO failure now means genuinely unsigned work
commits — `git rebase --signoff upstream/main` still fixes those.

This reverses earlier advice: unsigned merge commits *were* the dominant
failure before the exemption.

## Local

`env -u GH_TOKEN gh ...` — a stale `GH_TOKEN` shadows the keyring
credential and every call returns 401.
