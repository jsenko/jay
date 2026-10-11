# code: design

Why the code plugin works the way it does. What it does is in the
[README](README.md).

## 1. Below pr

code owns everything about writing and judging code. The pr plugin's
reviewer uses code's rules, and code references nothing in pr, so the
order is fyi → crew → code → pr. The other way round, anyone wanting the
coder role would install the GitHub watcher with it.

## 2. Quality and preferences are separate

A review holds someone else's code to a standard, and that standard
should not include one person's taste. So the rules are split by who
they apply to:

- **Quality** (Q, J, SC, A): what a reviewer would raise on anyone's
  code. Both the coder and the reviewer use them.
- **Preferences** (P): opinions about how code is written here: `var`,
  records over Lombok, how tests are written. Only code written in a
  coder session follows them.

jay ships its author's preferences, because a plugin with no opinions
gives no help. A user replaces them as a whole with
`~/.jay/rules/code-preferences.md`. Finer control, enabling and
disabling single rules, is a follow-up: a facility that loads rules by
ID.

## 3. Stable IDs

Every rule has an ID with a prefix per file. A review comment cites
"Q7", a user says which rule they disagree with, and a later tool can
switch rules on and off. That only works if IDs mean the same thing
forever, so they are never renumbered or reused, and a retired rule
keeps its row. The prefixes avoid R and O, which the reviewer uses for
required and optional findings.

## 4. Apicurio rules ship, in their own file

The first users are Apicurio developers, so their conventions ship with
the plugin, in a file loaded only in Apicurio and Apitomy repositories.
Other users never load it, and there is no setting to get wrong. Project
rules are often better in the project's own `AGENTS.md`; proposing them
there is a follow-up. The PR processes in the pr plugin are
Apicurio-specific too, and generalising both waits until other users
want them.

## 5. One command for all sizes

`/code:implement` handles a one-line fix and a multi-phase feature alike;
what changes is how much tracking it carries. Separate commands per size
would make the choice up front, when it is least known, and lose the
escalation when a fix turns into a feature.

## 6. Tracking files live in fyi's project folder

Design notes and phase files are private working material: analysis in
progress, things not ready to be public, and context for the next
session. They live in the project's folder, which fyi owns and hands out
as `folder`, not in the repository. One folder serves however many
checkouts a project spans, and a symlink, `.projects/<name>`, makes it
reachable from each.

They are not a tracker. Status belongs in GitHub issues once they exist,
and when the two disagree the issue is right.

## 7. Issue structure

Work too big for one release is shaped in three layers: an area epic per
capability, a milestone epic per release, and a work issue per PR. This
came from restructuring a long-running effort across two repositories,
where every one of these went wrong:

- **Items marked open that were done.** They had been finished through a
  different epic's phases and never reflected back. Found only by
  checking the code, not by reading either tracker.
- **Two epics describing the same plan,** one per repository, each
  claiming its own status.
- **Work recorded nowhere public:** a substantial piece of work existed
  in a local log and merged PRs, and in no issue.
- **The same ID used for two items,** because the list grew past the
  point where anyone read it end to end.

The drift is never a decision. The tracking file is what is in front of
you while working, so it gets updated and the epic does not. Hence a
fixed direction of reference (files cite issues, never the reverse) and
named moments to sync, rather than judgement.

**Anti-patterns** the rule exists to prevent:

| Anti-pattern | Instead |
|---|---|
| An epic with hundreds of checkboxes, open for years | Areas with State paragraphs; milestones for delivery |
| Status in a file and an issue | The issue owns status |
| A phase as an issue, which never closes | Phases as headings inside a milestone epic |
| Milestone epics written for releases after the next | Only the next one; later scope will change |
| A gitignored path cited in an issue or commit | Public text stands alone |
| Checkboxes treated as state | Sub-issues for the roll-up; checkboxes are decoration |
| The next milestone's epic as a parking place for cut work | Deferred, with reasons; the work stays in the area epic |
| Issues filed for work already merged | Issues are for work not yet done |
| A milestone epic padded with finished work | It lists what must happen to ship; release notes list contents |

**Sub-issues and references.** Sub-issues are a real parent and child in
GitHub: progress rolls up, and the link is queryable. A task list
(`- [ ] #123`) is text whose checkbox never follows the issue's state.
Sub-issues work across repositories but are not documented across
organisations, so a plan does not depend on that; such dependencies are
plain references.
