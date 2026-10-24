# Adoption epic

The issue shape for moving existing code to a decided target state: it
ships nothing a user sees, has an end, and often starts as an evaluation
issue. Read when shaping one; filing it is
`~/.jay/plugins/code/processes/adoption-planning.md`.

## Layers

Two: the epic and its work issues, one per PR. No milestone epic, since
an adoption has no release of its own. Its parent is an area epic, if
one covers the code.

## Sections

| Section | Holds |
|---|---|
| **Target state** | Checkable statements, linking to where they were decided, and in prose how to tell what is left ("search the test trees for raw create calls"). No commands or counts |
| **Decisions** | What is settled and where, so it is not argued again on each PR |
| **Items** | Ordered, one PR each. Finished ones stay in place, marked *done* with their PR, and are closed sub-issues; there is no separate "done so far". A large mechanical item is split by area |
| **Proto-issues** | Work that needs a design first, in the area epic's format |

**The last item is enforcement or a written convention**: a check where
one is practical, otherwise the rule written down where contributors and
reviewers read it.

**A large adoption**, whose items fall into several areas, is organised
by area as an area epic is, with its decisions as an Approach section
and the enforcement in a Conventions area.

## Lifecycle

- **From an evaluation:** an evaluation issue that ends in "yes" is
  rescoped in place, not closed and refiled.
- **Closes when** the target state holds and the convention is written
  down.

## Notes

Counts in the body go stale with every PR and invite editing the epic
on each merge; a target state stated so it can be checked stays true.
Without enforcement or a convention, new code drifts back to the old
pattern. Rescoping in place keeps the discussion that led to the
decisions next to them.
