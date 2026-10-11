# Issue structure

How GitHub issues are shaped for work too big for one release, so people
not doing the work can follow it. Read when shaping or reviewing issues;
filing them is `~/.jay/plugins/code/processes/issue-planning.md`.

## Three layers

| Layer | Answers | Lives | Closes when |
|---|---|---|---|
| **Area epic** | "What is this whole effort?" | Years, across releases | Rarely |
| **Milestone epic** | "What ships in 3.4?" | One release | The release ships |
| **Work issue** | "What is this PR?" | Days | The PR merges |

All three, always. Without milestone epics nothing says what ships when,
which is what others read. Without an area epic the long-term shape is
argued again each release.

## Area epic

- **Organised by area, a noun** (Validation, Dereferencing), never by
  phase or sequence. Areas survive re-planning.
- Each area: **State** (what exists, in prose, instead of a list of done
  tasks), **Gaps** (what "done" means), **Outstanding** (proto-issues).
- **A proto-issue** has a heading, an ID and a body that lets someone
  file it months later without redoing the research: the problem in
  prose, a goal, open questions. No effort or priority; those are judged
  when it graduates.
- **IDs** have a two-letter area prefix (`RR3`, `AP2`), so they never
  collide with an older scheme during a conversion.
- **No checkboxes or status.** Status is the milestone's.
- **Graduation:** a set chosen for a milestone becomes real issues listed
  in its epic, and leaves the area epic. State absorbs the outcome.

## Milestone epic

- On the release milestone, with a parent link to the area epic.
- **Goals:** user-visible outcomes.
- **Items:** a numbered list in dependency order, one PR each, not
  checkboxes. A dependency in another repository or organisation is an
  item too, marked external. Say when one item's result decides another.
- **Deferred:** what was cut, one line each, always with the reason. The
  work stays in the area epic.
- **Thin is right.** It lists what must happen to ship, not everything in
  the release. Work already merged is in the release notes.
- Only for the next release; later ones are written when they're next.

## Work issues

- **One issue per PR.** Work that can't be one reviewable PR is split.
- **Sub-issues** of their milestone epic in the same repository, for the
  progress roll-up. Across organisations, a plain reference and a
  sentence on what is awaited.
- Never filed for work already merged.

## Phases

Phases are an order of delivery; areas are a decomposition. Phases go
inside a milestone epic as headings, never as issues. A phase spanning
two milestones is mis-sized: split it where the milestone ends.
