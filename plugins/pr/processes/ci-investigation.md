# CI Investigation

Working out why a workflow failed. Read when a CI investigation job is
claimed, or a PR is red and the reason is not obvious.

## Start

A `ci-investigate` attention item, or a job claimed from the crew.

## 1. Is it actually failing?

Check `~/.jay/plugins/pr/rules/github-gotchas.md` first. Duplicate runs where the
cancelled one surfaces in the rollup, stale re-attempts that outrank a
genuine success, and `pull_request_target` workflows that `/retry` does
not re-run all produce red that has nothing to do with the code.

Look for a later success on the same SHA before reading any logs.

## 2. Read the failure

```bash
gh run view <run-id> --log-failed | tail -100
```

## 3. Classify

| Cause | Then |
|---|---|
| Compilation error in the PR | A required finding |
| Test failure caused by the change | A required finding, naming the test |
| Pre-existing failure, also on the base | Not this PR's. Say so, and file it |
| Flaky or infrastructure | Say so with the evidence — a passing re-run on the same SHA, or the same failure elsewhere |
| Missing or closed milestone, unsigned DCO | `~/.jay/plugins/pr/processes/pr-preflight.md`, not a code problem |

Do not call something flaky without evidence. "Re-run it" as a first
response is how a real intermittent bug stays hidden for months.

## 4. Record

Write the cause on the `pr` item's `ci_failures`: the workflow, when,
the run URL, and what was found. Clear `ci-investigate` and set
`check_status`.

If the fix belongs to someone else, or is bigger than this PR, file an
issue per `~/.jay/plugins/pr/processes/issue-hygiene.md` rather than leaving it in a
comment.
