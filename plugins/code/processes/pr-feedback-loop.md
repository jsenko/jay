# PR Feedback Loop

Watching a pull request you authored: review comments and CI. Read when
a PR exists for the current work.

## Start

After the PR is opened, or when a crew job hands over findings on it.
Check when woken, or every ~10 minutes if polling. Say nothing when
there is nothing new.

## Fetching

```bash
gh pr view <number> --json reviews,comments,statusCheckRollup
gh api repos/<o>/<r>/pulls/<n>/comments   # inline threads, bots' included
```

Compare against what was already seen, by timestamp. A job handing over
findings lists the PR's open threads too: they are part of the work.

## Review comments

Classify each new one, then act:

| Comment is | Do |
|---|---|
| A requested change | Analyse it, decide whether it is right, prepare the fix |
| A question | Draft an answer; the developer sends it |
| A suggestion | Assess the value; say whether it is worth taking |
| From Copilot or another bot | A review comment like any other: classify it by what it asks |
| Approval or acknowledgement | Note it, say nothing |

For anything actionable, present before changing code:

```
[<reviewer>] <what they asked for>
  Assessment: <whether they are right, and why>
  Fix: <what would change>
```

A reviewer can be wrong. Say so with the reason rather than complying
silently — the developer is the one who has to defend the change.

Replies are part of addressing them, bots' included: one per comment,
saying what changed and in which commit, or why it was not taken, written
to Public text in `~/.jay/plugins/code/rules/git.md`. Show them with the
push confirmation; on the yes, push, then post each as a reply to its
thread (`gh api repos/<o>/<r>/pulls/<n>/comments/<id>/replies -f body=…`).
In a crew job, they go with the push under whatever approval it has.

A bot's thread whose suggestion was taken is then resolved (GraphQL
`resolveReviewThread`), since nobody else will; a declined one stays
open. A person's thread is theirs to resolve.

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
