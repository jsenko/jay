# Issue planning

Filing GitHub issues for a settled plan, or restructuring an existing
large epic, following `~/.jay/plugins/code/rules/issue-structure.md`.

## Start

From `~/.jay/plugins/code/processes/issue-sync.md`, once the user agrees
to turn a plan into issues; or when the user asks to restructure an epic.
Issues are public commitments in the user's name: show what will be
filed, and file nothing they haven't agreed to.

## Filing for a plan

1. **Area epic:** find the existing one, or draft one from the template.
2. **Milestone epic** for the next release only, from the template.
3. **Work issues** for that milestone's items, as sub-issues of its epic.
   Search first; an existing issue covering the same work is reused.
4. Replace each item's heading in the milestone epic with its issue link,
   keeping the description.
5. Record the area epic and the milestone epic in the project's `issues`
   (`fyi_update`), and map local IDs to issue numbers once, in `PLAN.md`.

## Restructuring an existing epic

Context that took months to gather stays; history is not rewritten.

1. Reorganise the epic from phases to areas, and move status out of it.
2. Completed rows collapse into each area's **State**; outstanding rows
   survive under **Outstanding**. Local IDs map to what shipped in the
   tracking files, not in the epic.
3. Check status against the code, merged PRs or built output, never
   against another tracker.
4. Create the milestone epic for the next release only.
5. File work issues only as a milestone claims the work.

## Checking the result

- The area epic is organised by noun.
- The next release has a milestone epic with goals, items and deferred.
- Every item is one PR.
- Dependencies across organisations are plain references.
- No fact about status lives in two places.

## Area epic template

```markdown
## Epic: <capability, not project name>

<Two or three paragraphs: what this covers, who uses it, why it exists.>

Related: <area epics this depends on or feeds>

Items below are proto-issues: not yet issues, with enough context to
become one. When chosen for a release they move to its milestone epic.

---

## <Area: a noun>

**State.** <What exists today, in prose.>

**Gaps.** <What is missing, and what "done" would look like.>

### Outstanding

#### XX1. <Short imperative title>

*<Depends on / Unblocks / Legacy id: only what applies.>*

<What exists now, what it cannot do, why that matters to a user.>

**Goal.** <The observable outcome.>

**Open questions.**
1. <What must be decided before this can be estimated.>
```

Depth follows uncertainty: a cleanup needs two sentences, an open design
question needs the question written down.

## Milestone epic template

```markdown
## <Capability>: <release> <qualifier, e.g. tech preview>

Parent epic: #<area epic>

<Why this release, and what a user gets that they didn't have before.>

### Goals
- <User-visible outcome>

### Items

Ordered by dependency. Each item is one PR unless noted.

1. <other-org/repo>#<n>: *external.* <Why it gates the rest.>
2. #<n>: <What changes.> Depends on item 1.
3. #<n>: <…> **The result of this item decides item 8.**

### Deferred

Recorded so the scope question stays settled. The backlog is #<area epic>.
- **<Thing>**: <why it is not here>

### Open questions
- <What must be answered before an item can be sized>
```
