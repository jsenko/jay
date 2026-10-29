---
description: Check out a PR and brief the user for manual review
argument-hint: <pr-number-or-url>
---

# Overview

Prepare for a review the user does themselves: check the branch out, and
brief them well enough to start reading code immediately.

This command does not review. The verdict at the end is theirs — it is
the one part of the workflow that never runs unattended.

# Input

PR: $ARGUMENTS — a number, a URL, or `Owner/Repo#123`. Ask if absent,
or suggest `/pr:queue` when the user does not have one in mind.

# Process

## 1. Preflight

`~/.jay/plugins/pr/processes/pr-preflight.md`. If the PR is blocked on a milestone, a DCO
trailer, or an issue already fixed, say so now — that may be the whole
answer, and it is a waste to read a diff first.

## 2. Check out

Refuse on a dirty tree; offer to stash. For a fork, add the remote,
fetch, and branch from it; otherwise `gh pr checkout`.

## 3. Gather

Metadata, labels, linked issues, existing reviews and comments, and the
`pr` item if one exists. Note what the automated review already found,
so the user is not re-reading what is already recorded.

## 4. Brief

Readable in thirty seconds, and oriented on the decision:

- What it does, and the issue it closes
- What the automated review found, by id — what is outstanding, and
  whether a `draft_review` is waiting to be posted
- Whether the author addressed the last round
- Anything blocking that is not the code: CI, milestone, DCO
- What the user needs to decide

Detail on request — files, review threads, a diff, the full item.

## 5. Close the round

The user finishes; remind them the round is not over until a verdict is
recorded. Approve, request changes, comment only, or skip for now.

**Post nothing without the user's go-ahead**, the verdict included. A
`draft_review` goes out with the verdict they choose, edited as they ask,
and is then cleared.

**Only optional findings outstanding?** Approval does not wait for the
author's answer on them — optional is the author's call. Their answer
decides when to merge, not when to approve: wait for the push if they
chose to address something here.

Then set `manual_review` and `manual_reviewed_commit`, and `crew_send`
the watcher what happened; it recalculates `attention`. The GitHub review
event is the fallback if that message is missed. *Skip* changes nothing.

**The user's own PR** has no verdict. Offer to hand the findings over,
per `~/.jay/plugins/pr/processes/own-pr-review.md` step 3.

# Notes

Facts, not a data dump. Show what needs action rather than everything
that exists.
