# Issue Hygiene

Filing and shaping issues, usually from things found while reviewing.

## Start

A review found something that belongs in its own issue, an author asked
for an optional finding to become a follow-up issue, or an existing issue
needs labelling or combining.

For a follow-up: the finding's text is the issue body, link the PR, then
comment the issue link on the PR and record it in the item's `followups`.

## Search first

Existing issues cover more than expected. Six findings from one sweep
collapsed into a single issue once three existing ones were found to
cover part of it.

## Combine or split

| | |
|---|---|
| **Split** | The parts have independent value, or different owners |
| **Combine** | One part is a prerequisite for the other, or they share a root cause and a fix |

Two defects where the UI half could not be fixed until the server half
landed are **one** issue with two parts. A spec change affecting five
generated clients **is** its own issue, because it has value regardless
of the bug that surfaced it.

There is a practical reason to prefer combining: a contributor holding
three related issues hits the three-issue assignment cap for what is
really one piece of work.

## Re-check before acting

Anything older than about a week gets reproduced first. Issues get fixed
incidentally by unrelated work and nobody closes them.

## Beginner-friendly

Label an issue `Beginner Friendly` and `good first issue` when it names
the exact file and line, needs no design decision, and reproduces
easily. Decide at filing time, while the context is fresh.

**Never label an `area/CI` issue**, whatever its size — nor anything
nested under it, such as `area/CI/automation`. Nesting inherits the
restriction.

## CI is maintainer-only

Anything under `.github/` — workflows, CI scripts, lifecycle and
validation automation — is maintainer-only. Do not label it for
newcomers, do not suggest it to a contributor, and expect a community CI
PR to be closed.

Both the assignment automation and `CONTRIBUTING.md` now say so, so a
contributor has a way to know. Still worth saying plainly when it comes
up, since people do not read contributing guides.

## Assigning

`gh issue edit --add-assignee` false-negatives: it validates against
`assignable_users`, which excludes commenters. Use
`POST /issues/{n}/assignees`.
