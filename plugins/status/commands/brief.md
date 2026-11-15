---
description: A brief status for teammates, covering the days since the last one, ready to paste into a channel
argument-hint: [period, default: since the last brief]
---

# Overview

A short status for teammates, posted every couple of days to cover
what meetings miss: what was completed, what is planned, and what is
blocked. Not `/status:weekly`: a quick check-in, then bullets, no prose.

# Period

`$ARGUMENTS` if given. Otherwise run `date +"%A %Y-%m-%d"`, then find
the latest brief: `fyi_search`, type note, `include_archived: true`,
`where: {tags: {all: ["report", "brief"]}}`. The period runs from the
day after the end date in its title to today. With no earlier brief, it
is yesterday and today.

State the period in the reply's first line, naming what it continues
from ("since the brief of 13–17 Oct"), with any weekday taken from
`date`. It needs no confirmation, unless it is longer than a
week, which is a question for the user.

# Gather

Follow `~/.jay/plugins/status/processes/gather.md` for the period,
through its check-in.

# Write

Three sections, in this order, each a plain label on its own line with
bullets under it:

```
Completed:
- …

Planned:
- …

Blockers:
- None.
```

- **All three always appear.** A section with nothing in it is
  `- None.`, so a reader finds each in the same place every time.
- **Each item goes in the section it fits best.** There is no fourth
  section: what was learned goes with the work it came from, and an
  item that fits none of them is left out.
- **Completed:** what was done and why it mattered, including what came
  of conversations with others.
- **Planned:** what is next in the coming days, and time off.
- **Blockers:** what is stuck, and what it waits on.
- **Length:** at most 100 words per working day of the period, and 300
  in all.
- Each bullet is one line, not hard-wrapped, so it reflows when pasted.
  No other headings, bold or nesting.
- A PR or issue number only when it is the point.

A period with nothing done still has all three sections, not padding.

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
