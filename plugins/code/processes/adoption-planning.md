# Adoption planning

Filing an adoption epic, shaped by
`~/.jay/plugins/code/rules/adoption-epic.md`.

## Start

When the user decides to move existing code to a target state, or an
evaluation issue ends in "yes". Show the epic before filing or editing
it: it is a public commitment in the user's name.

## Rescoping an evaluation

1. Retitle it `Epic: <the target state, as a capability>`.
2. Replace the proposal text with the template below. Keep the opening
   problem statement, and say in one line that the issue started as an
   evaluation.
3. Link each decision to the comment where it was made. The discussion
   stays as it is.
4. Work issues already filed become sub-issues; merged work becomes a
   *done* item with its PR.

## Filing

1. Search for an evaluation issue or an existing epic first; one found
   is rescoped, not duplicated.
2. Draft from the template, and check each target state can be checked.
3. File work issues for the items that are ready, as sub-issues.
   Proto-issues stay in the epic until designed.
4. Record the epic in the project's `issues` (`fyi_update`).

## Template

```markdown
## Epic: <target state, as a capability>

<The problem in prose: what the code does now, why that hurts, and the
example that started this.>

<This issue started as an evaluation. The answer is …, and it now
tracks that adoption.> (only when rescoped)

### Target state

- <A checkable statement.>
- The convention is written down where contributors and reviewers find it.

<How to tell what is left, in prose.> <What is out of scope, and where it
belongs.>

### Decisions

Settled in [<where>](<link>):

- **<Decision>.** <Why, in a sentence.>

### Items

In order, one PR each unless noted.

1. #<n> (*done*, #<pr>): <What changed.>
2. #<n>: <What changes.> <Why it comes here in the order, if not obvious.>
3. <Enforcement, or writing down the convention.>

### Proto-issues

#### <XX1>. <Title>

<The problem, the goal, open questions.>

Related: <area epic, other epics>
```
