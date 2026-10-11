# Issues and Tracking Files

Turning a settled plan into GitHub issues, and keeping the two from
drifting afterwards.

How issues are shaped is `~/.jay/plugins/code/rules/issue-structure.md`;
filing them is `~/.jay/plugins/code/processes/issue-planning.md`. This is
the split between issues and tracking files, and keeping them in step.

## Start

The plan has stopped moving, or work is being picked up again and the
tracking files have not been checked against the issues in a while.

## The split

Both look like they record progress. Letting both do so is the mistake.

| | Issues | Tracking files |
|---|---|---|
| Status, assignment, what ships when | **yes** | never |
| Public commitments | **yes** | never |
| Design rationale, options rejected and why | no | **yes** |
| Chronological decisions | no | **yes** |
| Half-formed ideas, open questions | no | **yes** |

## Creating the issues

**Ask first.** Issues are public commitments made in the user's name;
which parts become issues, and how they are framed, is theirs. Then
follow `~/.jay/plugins/code/processes/issue-planning.md`.

## Pointing them at each other

**One direction only.** Tracking files reference issue numbers; issues
never reference tracking-file paths. Those directories are usually
gitignored, so such a reference is dead for every reader but the user.
The same goes for commit messages and PR descriptions — they have to
stand alone.

**Record them on the project.** Put the area epic and the current
milestone epic in the project's `issues`, so every session finds them
from the handoff instead of searching. Add each new milestone epic as
it is filed.

**Map local ids once.** Working shorthand (`C42`, `R2`) is useful in
notes and meaningless to everyone else, so one table maps it to issue
numbers and everything public uses the number.

**`PLAN.md` is an index, not a tracker.** The moment it grows its own
status column there are two sources of truth.

## Syncing

**When they disagree, the issue is right.** Fix the file.

Check at the points where being wrong costs something:

- picking the work up again, before trusting what a file says
- a phase boundary, when the next set of issues gets filed
- before a status report, which reads from both

What to check, starting from the project's `issues`: issues closed
since last time whose tracking entry still looks open, work issues with
no milestone epic, and anything in the tracking files that has quietly
become a public commitment without an issue. Every linked issue closed
means the project is probably finished — suggest setting it `done`.

## Notes

The drift is not caused by carelessness. It happens because a tracking
file is the thing in front of you while working, so it gets updated and
the issue does not. That is why the direction of reference is fixed and
why the sync has named trigger points rather than being left to
judgement.
