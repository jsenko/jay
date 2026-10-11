---
description: Implement a change, with as much or as little tracking as it warrants
argument-hint: [issue, PR, or description]
---

# Overview

The coding command. Handles anything from a one-line fix to a multi-phase
feature; what changes is how much tracking it carries, not how the work
is done.

# Prerequisites

- `~/.jay/plugins/crew/rules/always.md`, `~/.jay/plugins/code/rules/git.md`
- While writing code: `~/.jay/plugins/code/rules/quality.md` and what it
  points to; `~/.jay/rules/code-preferences.md` if it exists, else
  `~/.jay/plugins/code/rules/preferences.md`; and in an Apicurio or
  Apitomy repository, `~/.jay/plugins/code/rules/apicurio.md`

# Start

## 1. Understand the work

From `$ARGUMENTS`, or ask. Accept an issue number or URL (`gh issue
view` it and summarise), a PR that needs changes, or a description.

## 2. Choose the weight

| Weight | When | Tracking |
|---|---|---|
| `none` | A fix, a small refactor, one sitting | None |
| `single-doc` | One coherent change, one PR, worth a design note | `~/.jay/plugins/code/processes/feature-tracking.md` |
| `phased` | Several PRs, each reviewable on its own | Same, plus phases |

Infer it and say which you picked; ask only when it is genuinely
borderline. Starting at `none` and escalating is normal and costs
nothing; tracking that nobody reads is worse than none.

Anything above `none` needs a project item. Create one with
`fyi_capture` if it does not exist, linked to this directory.

## 3. Set up the workspace

Confirm the repository and a clean tree, fetch, then create or switch to
a branch, confirming the name. Note whether pushes go to origin or a
fork.

# The loop

After every significant change:

1. **Build.** Compile, and run tests if they are quick. Report failures
   at once rather than continuing on top of them.
2. **Read your own diff** against the rules above. Fix what is plainly
   wrong without asking, citing the rule's ID. Raise anything that
   changes behaviour.

Before committing: confirm the change, write a commit message about
*why*, and do not push unless asked.

# While a PR is open

Follow `~/.jay/plugins/code/processes/pr-feedback-loop.md`.

# Documentation

When the change needs user-facing documentation, follow
`~/.jay/plugins/code/processes/feature-docs.md`.

# Behaviour

- **Ask before changing code** when the developer asked a question.
  A question is not an instruction.
- **Confirm each task** and say what remains.
- **Disagree where it matters.** Suggest the better approach and say
  why; the developer decides.
- **Capture decisions as notes** against the project when they are made.
- Update `current_state` before the session ends.
