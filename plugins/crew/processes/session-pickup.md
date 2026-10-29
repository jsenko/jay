# Session pickup

Offering a new session the chance to continue one that stopped, from
the note `~/.jay/plugins/crew/processes/session-save.md` wrote.

## Start

**Source:** `/crew:start` → this session: after the ready report, or
for an `unattended` role, before its Startup
**Processed by:** this session, once

| Role | Then |
|---|---|
| Attended | Find candidates, offer, and pick up only on a yes |
| `unattended` | Find candidates and read the best one at once, without asking: nobody is there to answer, and its Startup depends on it. Check it against the present as in Pick up, step 2, but leave it active: stop updates it in place |

## Find candidates

`fyi_search({type: ["note"], where: {tags: {all: ["session"]}}, scope: "all"})`
lists the notes that have not expired. Read the header of each with
`fyi_get` only while it might match.

| Matches | Weight |
|---|---|
| The same role | Required, unless the purpose names the note's project. Always, for an `unattended` role |
| The same directory, or a checkout of the same repository | Strong |
| The purpose names the note's project, or describes the same work | Strong |
| Neither directory nor purpose | Not a candidate |

A watcher run from another directory, or a second checkout of the same
repository, still matches: the repository counts, not the path.

## Offer

Attended roles only. At most three, newest first, after the ready report:

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
