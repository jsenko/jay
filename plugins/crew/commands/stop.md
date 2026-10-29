---
description: End the session, save what is in progress, and leave the crew
---

# Overview

Wind down cleanly so nothing is left half-done and no work is stranded
waiting on a session that has gone.

# Process

## 1. Save what would otherwise be lost

Anything in progress that another session could not reconstruct:

- **Project work** — write the project's `current_state`: where this
  session stopped and what comes next. This is what
  `fyi_handoff` gives the session that picks it up, from any directory.
- **Decisions not yet captured** — a note each, against the project.
  The reasoning is the expensive part to reconstruct.
- **A review in progress** — record findings so far on the `pr` item,
  then return to the default branch.
- **Uncommitted changes** — tell the user, do not act. Whether to commit
  or stash is theirs.
- **The session itself** — ask whether to save a note a later
  `/crew:start` can offer to pick up, per
  `~/.jay/plugins/crew/processes/session-save.md`.

## 2. Resolve or release claimed work

Every job this session holds: `crew_resolve` with `done` if it is
finished, `released` if it is not. Releasing puts it back for someone
else; leaving it claimed makes it wait out the lease for nothing.

## 3. Announce

`crew_send` to `all`, one line on what this session was doing. Nothing
here is a handoff: a session that joins later never sees it, so what the
next one needs is already in step 1.

## 4. Leave

`crew_leave`.

## 5. Confirm

```
<session-id> stopped.
  Saved:    <what was written>
  Released: <jobs handed back, if any>
```

## 6. Notice a missing role

If this session spent its time on one recognisable kind of work that no
role describes (`/crew:start` lists where roles live), say so, once, in
a line, and offer to write one to `~/.jay/roles/<name>.md`, following
`~/.jay/plugins/crew/rules/authoring.md`. Include what it would
advertise to the crew and what it would load.

Only when it would plausibly recur. A one-off is not a role.

# Notes

This is the same for every role. What differs is what is in progress,
and step 1 covers that by asking what would be lost rather than by
branching on the kind of session.
