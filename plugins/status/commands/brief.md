---
description: A brief status for teammates, covering the days since the last one, ready to paste into a channel
argument-hint: [period, default: since the last brief]
---

# Overview

A few bullets for teammates on what the user has been doing, posted
every couple of days to cover what meetings miss. Not
`/status:weekly`: no interview, no prose.

# Period

`$ARGUMENTS` if given. Otherwise run `date +"%A %Y-%m-%d"`, then find
the latest brief: `fyi_search`, type note, `include_archived: true`,
`where: {tags: {all: ["report", "brief"]}}`. The period runs from the
day after the end date in its title to today. With no earlier brief, it
is yesterday and today.

State the period in the reply's first line; it needs no confirmation.

# Gather

Follow `~/.jay/plugins/status/processes/gather.md` for the period.

# Choose

Apply `~/.jay/plugins/status/rules/sharing.md`. Ask only what it says to
ask; otherwise go straight to writing.

# Write

- Bullets, under 150 words, with no headings, bold or nesting.
- Each bullet is one line, not hard-wrapped, so it reflows when pasted.
- What was done and why it mattered, including what came of
  conversations with others.
- Something learned, from `learned` notes, when there is one.
- Blockers, with what they wait on, when there are any.
- A PR or issue number only when it is the point.

A period with nothing worth sharing gets one line saying so, not padding.

# Save

`fyi_capture` a note:

| Field | Value |
|---|---|
| `title` | `Status brief: <start> -- <end>` |
| `tags` | `report`, `brief` |
| `archive_after_days` | 14 |
| `content` | the brief |

If a brief for the same period exists, `fyi_update` it instead.

Then print the brief in full, in a fenced block, so it copies exactly.
