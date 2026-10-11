# Feature Tracking

Keeping a record of a feature while it is built. Read when work carries
tracking weight — not for a quick fix.

## Start

When `/code:implement` selects `single-doc` or `phased`, or when a project item
already has that weight.

## What tracking files are for

Three things, and nothing else:

- **Working through analysis**, while iteration is fast and local.
- **Work that should not be public** — anything not ready to be seen, or
  that never will be.
- **Giving a new session context**, so picking the work up again does not
  mean re-deriving it.

They are not a tracker. Status, assignment and what ships when belong in
GitHub issues, and letting both hold them is how they diverge until
neither can be trusted. `~/.jay/plugins/code/processes/issue-sync.md`
has the split and what to do about it.

## Weight

The same ladder as a project's `weight` field. Pick the lightest that
fits; escalating later is cheap, and tracking nobody reads is not.

| Weight | Documents | For |
|---|---|---|
| `none` | None | A fix, a small refactor, anything one sitting finishes |
| `single-doc` | `DESIGN.md`, `TASKS.md` | One coherent change, one PR |
| `phased` | Adds `PLAN.md`, `PHASE-<n>.md` | Several PRs, each independently reviewable |

Create the project item first with `fyi_capture` if it does not exist,
linked to this work directory.

Documents live in the project's folder: its `folder`, from `fyi_get` or
`fyi_handoff`. Each work directory links to it with a symlink at
`.projects/<name>`, where `<name>` is the folder's own name. One place
holds a project's files however many checkouts it spans, a checkout can
host several projects, and none of it reaches git: `.projects` belongs
in the repo's `.gitignore`.

## Documents

| File | Holds | Not |
|---|---|---|
| `DESIGN.md` | The problem, options considered, what was chosen and why | Tasks, or code except where it explains the design |
| `TASKS.md` | Checkboxes: short title, a few sentences each | Detail that belongs in a note |
| `PLAN.md` | Phases and their objectives, current phase, progress — until issues exist; then only the id-to-issue map | Task detail |
| `PHASE-<n>.md` | Tasks for one phase | — |

Decisions go to `fyi_capture` as notes against the project, not into a
log file. Those notes in date order *are* the project's history, and
`fyi_handoff` reads them.

## Tasks

Work in a sensible order, tick as you go, and add tasks as they are
discovered — confirming first when the addition is significant.

Report progress as counts: "5/8 tasks, phase 2 of 4". Keep the count in
the file's header so it is visible without reading the whole thing.

## Phases

Only for `phased`. Each phase is sequential, builds on the last, ends in
its own reviewable PR, and includes its own testing task.

Confirm with the developer before closing a phase. Expect exploration
outside the plan and keep the plan matching what actually happened —
a plan describing work that did not occur is worse than none.

When a phase fails: say which decision caused it and how much is
affected, then offer fixing in place, returning to the last good phase,
a remediation phase, or splitting out the bad part. Record the failed
attempt rather than deleting it.

## When the plan settles

A plan that has stopped moving should stop being private. **Ask the user
whether to turn it into GitHub issues** — do not do it unprompted, since
it makes commitments on their behalf and they may want it shaped
differently or not public at all.

Then follow `~/.jay/plugins/code/processes/issue-sync.md`: shape the issues, map local ids to
issue numbers once, and point the tracking files at them.

## Done

Implementation complete is not done.

1. **Complete** — every task ticked, tests passing, docs updated, no
   known blocking issue, and the developer agrees. Summarise what was
   built and any deviation from the design, then open the PR.
2. **Under review** — address feedback per
   `~/.jay/plugins/code/processes/pr-feedback-loop.md`. Capture decisions from review as
   notes.
3. **Done** — the PR is merged. Set the project's `status` and
   `current_state`; archiving moves it out on its own.

## Testing

Every phase or task set includes its own validation task. Prefer
automated tests; a script or a manual check is better than nothing.
Define the expected behaviour before writing the test.
