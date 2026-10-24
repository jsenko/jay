---
description: A weekly report of your work for the wider organisation, saved to fyi
argument-hint: [period, default: the week after the last report]
---

# Overview

What the user did over a week, written from their perspective and about
why rather than how: something to present to a manager or at a
retrospective. Not `/status:brief`, which is bullets for the team.

# Period

`$ARGUMENTS` if given. Otherwise run `date +"%A %Y-%m-%d"`, then find
the latest report: `fyi_search`, type note, `include_archived: true`,
`where: {tags: {all: ["report", "weekly"]}}`, reading the period from
its title.

| Situation | Period |
|---|---|
| A previous report | The day after its end, for as many days as it covered |
| None, but a `decision` and `status` note says how the user's weeks run | As that note says |
| Neither | The seven days ending yesterday |

Reports are usually asked for on the period's last day or the working
day after. A period that ends in the future, or more than one period
back, is a question for the user, not a guess.

Confirm the period in one line before gathering, naming what it
continues from: "14–20 Oct, Wednesday to Tuesday, after the weekly of
7–13 Oct". Take each weekday from `date`, never work it
out. When the user states
how their weeks run, offer to keep it as a note tagged `decision` and
`status`.

# Gather

Read the previous report, then follow
`~/.jay/plugins/status/processes/gather.md` for the period, through its
check-in.

# Write

Prose, four to eight paragraphs, grouped by theme or project.

- Work finished, with a sentence on why it mattered.
- Reviews, naming the contributor and what their work enables.
- Conversations with others and what came of them.
- Decisions, with their reasoning.
- Issues filed and investigations started, as the next steps of the
  work they continue.
- Mid-term plans: each active project's direction, from its
  `current_state`.
- Continue the previous report's threads rather than repeating them.

Identifiers go in parentheses. Do not hard-wrap: each paragraph, heading
and bullet is one line, with a blank line between paragraphs.

End with **Pending**, from `fyi_today`, and **Blocked**, with what each
item waits on. Add **Notable team activity** only where it gives context.

# Save

`fyi_capture` a note titled `Weekly report: <start> -- <end>`, tagged
`report` and `weekly`, with the report as `content`. If one for the same
period exists, `fyi_update` it instead.

Then print the report in full, so it can be copied.
