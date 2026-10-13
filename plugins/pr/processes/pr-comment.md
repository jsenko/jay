# PR Review Comment

Writing the review comment. Read when about to post one.

## Sections

In this order. Omit any that would be empty.

| # | Section | When |
|---|---|---|
| 1 | **Decision** | Always |
| 2 | `## Context` | Complex PRs. Skip on re-review and on ordinary bugs |
| 3 | `## Direction` | Only when the approach is worth discussing |
| 4 | `## Required changes` | Anything blocking merge |
| 5 | `## Optional changes` | The author's call |
| 6 | `## Checked` | Always |

## Post or draft

Unattended, a review is posted only in the two cases below. Anything
else is written to the `pr` item's `draft_review`, and the user posts it
with their verdict through `/pr:checkout`.

| Findings | Unattended | Verdict |
|---|---|---|
| Required, every one verified; no Direction section, no `decide` item; complexity at most `moderate` | Post | Request changes |
| Optional only | Post, ending with the follow-up question below | None — approval is the user's |
| Required, but any condition above fails | Draft | The user's |
| None | Draft | The user's |

**Verified** means reproduced, tested or run — not reasoned about. One
plausible required finding drafts the whole review.

With the user present, show the review first in every case.

## 1. Decision

Lead with it. Short, and the first sentence matches the verdict — never
open with "solid" or "clean" when blockers follow.

On a re-review, say what was addressed here. That is the author's first
question and they should not have to scroll for it.

## 2. Context

Three parts, in order:

1. **What the thing is.** Define the tool, mechanism or concept the
   review refers to, and what it measures or does — including the
   intended end state if the feature is not switched on yet. *Err toward
   more detail.* Numbers in a review are unreadable without the mechanism
   behind them.
2. **The problem the PR solves.**
3. **What the PR does about it**, in a sentence or two.

## 3. Direction

Before the changes sections, deliberately: if the approach is wrong, the
implementation detail does not matter, and it tells the author what to
read first.

**A genuine open design question is not posted as an opinion.** Say a
question exists and that the maintainer will weigh in, raise a `decide`
attention item, and stop. Arguing a position pre-empts the decision.

## 4 and 5. Changes

Two sections, not three. The author's decision is binary: must this
happen before merge, or is it their call. A finding not worth blocking on
is optional — say "strongly recommended" inside Optional rather than
inventing a middle category that hides whether it blocks.

Every item gets an id: `R1`, `R2` for required, `O1`, `O2` for optional.

**Ids are assigned once per PR and never reused or renumbered.** A
re-review continues the sequence. Renumbering makes "R1 from my earlier
review" quietly mean something else.

```
### R2 — Version comparison uses startsWith

`VersionUtil.java:88` — `3.3.1` matches `3.3.10`.
Use `Semver.coerce()` and compare components.
```

Name the file and line. Say what to change and why. Group findings that
share a root cause.

**Optional only: ask the author to choose.** End the section with:
*None of these block merge. For each, let us know whether you would like
to address it here, prefer a follow-up issue, or would rather skip it —
e.g. "O1 here, O2 issue".* The ids are what make a one-line answer
possible.

**Inline comments are pointers, not copies.** Where a line anchor helps,
post `**R2** — <one line>` inline and leave the full item in the summary.
Inline positions break on force-push, so the summary is the source of
truth.

## 6. Checked

Everything non-actionable, with one job: letting the reader judge how far
to trust the review.

- **What was verified versus taken on trust.** Say which is which.
- What was checked and found fine.
- Credit for anything the contributor found beyond the review items — as
  its own line, not buried.
- What happens next, and who merges.

## Tone

**Do not apologise for latency or capacity.** No "sorry for the delay",
no "this is on us". It frames the project badly when the cause is simply
volume. Thank them for their patience instead.

Reserve ownership language for a specific, identifiable failure — a bug
that cost the contributor two days is worth owning by name.

English always, whatever language the contributor writes in.
