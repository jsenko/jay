# Session pickup

Offering a new session the chance to continue one that stopped, from
the note `~/.jay/plugins/crew/processes/session-save.md` wrote.

## Start

**Source:** `/crew:start`, after the ready report → this session
**Processed by:** this session, once

Not for an `unattended` role: it rebuilds its state from its own sources
at startup, and nobody is there to answer.

## Find candidates

`fyi_search({type: ["note"], where: {tags: {all: ["session"]}}, scope: "all"})`
lists the notes that have not expired. Read the header of each with
`fyi_get` only while it might match.

| Matches | Weight |
|---|---|
| The same role | Required, unless the purpose names the note's project |
| The same directory, or a checkout of the same repository | Strong |
| The purpose names the note's project, or describes the same work | Strong |
| Neither directory nor purpose | Not a candidate |

A watcher run from another directory, or a second checkout of the same
repository, still matches: the repository counts, not the path.

## Offer

At most three, newest first, after the ready report:

```
Earlier sessions to pick up:
  1. <role> in <directory>, <n> days ago: <first line of Where it stopped>
```

Then ask whether to continue one. Never pick one up unasked. With no
candidates, say nothing.

## Pick up

1. Read the note in full, and `fyi_handoff` its project if it has one.
2. Check what it says against the present: the branch, uncommitted
   changes, the issue's state. Where they disagree, the present wins.
3. Archive the note (`fyi_update`, `archived: true`), so it is not
   offered again, and carry on from its **Next**.
