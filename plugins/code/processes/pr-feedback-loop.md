# PR Feedback Loop

Watching a pull request you authored: review comments and CI. Read when
a PR exists for the current work.

## Start

After the PR is opened. Check when woken, or every ~10 minutes if
polling. Say nothing when there is nothing new.

## Fetching

```bash
gh pr view <number> --json reviews,comments,statusCheckRollup
```

Compare against what was already seen, by timestamp.

## Review comments

Classify each new one, then act:

| Comment is | Do |
|---|---|
| A requested change | Analyse it, decide whether it is right, prepare the fix |
| A question | Draft an answer; the developer sends it |
| A suggestion | Assess the value; say whether it is worth taking |
| Approval or acknowledgement | Note it, say nothing |

For anything actionable, present before changing code:

```
[<reviewer>] <what they asked for>
  Assessment: <whether they are right, and why>
  Fix: <what would change>
```

A reviewer can be wrong. Say so with the reason rather than complying
silently — the developer is the one who has to defend the change.

After addressing, prepare a short reply per comment saying what changed,
so the developer can work through the conversation quickly.

## CI

For each failing check, fetch the failure and classify the cause:

```bash
gh run view <run-id> --log-failed | tail -100
```

| Cause | Do |
|---|---|
| Compilation error in this PR | Fix it |
| Test failure caused by this change | Fix it, or explain why the test is wrong |
| Flaky or infrastructure failure | Say so, with the evidence. Do not retry blindly |

## Finishing

When comments are addressed and CI is green, say so and stop checking.
Merging is the developer's.
