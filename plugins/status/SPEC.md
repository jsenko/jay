# status: design

Why the status plugin works the way it does. What it does is in the
[README](README.md).

## 1. One gathering, two reports

Everyone on a team writes some kind of report, in their own way. Two
audiences need different things from the same activity:

| | Brief | Weekly |
|---|---|---|
| Audience | Teammates, every couple of days | The wider organisation |
| Done | PRs, issues, tasks finished | Achievements, by project or theme |
| Next | What is due in the next few days | Each project's direction |
| Blockers | Blocked tasks | Those that matter beyond the team |
| Learnings | Notes tagged `learned` | Decisions, with their reasoning |
| Form | Bullets, pasted into a channel | Prose |

So the gathering is one process, `processes/gather.md`, and each command
is about its audience and form. GitHub alone shows what changed. fyi adds
why: finished and blocked tasks, decisions, and what was learned.

## 2. Search, not a repository list

The gathering searches all of GitHub for the user's activity instead of
reading a list of repositories.

- A status is about a person, and their work goes wherever it goes: a
  contributor's repository, a discussion in another project, a side
  project.
- A teammate installing status has nothing to configure.
- A list goes stale silently, and the report then misses work without
  saying so.

The cost is that personal activity turns up too. That is handled by
asking, not by filtering (§3).

## 3. Purpose decides, and the user is asked

`rules/sharing.md` states the purpose: tell the team the interesting
things the user did. Rather than an organisation filter, which would
also hide personal work worth sharing, activity that looks personal is
asked about.

Interaction with others is gathered as carefully as code. Discussions
with contributors are often where a design was settled or a problem was
understood, and a report that lists only PRs misses it.

Security work that isn't public is always asked about before it is
reported. A report travels further than the repository it came from, and
an embargoed fix described in a channel is a disclosure.

Both commands check in before writing, with what the status will say
and a question about what is missing. Meetings, chat, email and time off
leave no trace in GitHub or fyi, and they are often what a reader most
needs. The user's answer is taken at the level they give it: a status
that costs an interview stops being written.

Standing answers are kept as fyi notes tagged `decision` and `status`
rather than in configuration: they are decisions the user made, they are
read the same way as everything else, and they need no settings file.

## 4. Reports are fyi notes

Reports are saved as notes, not files in a folder.

- A plugin does not write into another plugin's data, and fyi's store is
  fyi's.
- The next report reads the previous one: for its period, and for the
  threads it said would continue.
- Notes are searchable, and the fyi dashboard can show them.

Briefs expire after 14 days (`archive_after_days`), since only the latest
matters for the next period. Weekly reports stay until the user archives
them; they are the record a year-end review is written from.

## 5. Periods are inferred

The period comes from the last report of the same kind, so there is no
setting for when a week starts. Reports are asked for on the period's
last day or the working day after, so anything else (a period ending in
the future, or a missed week) is put to the user rather than guessed.
The weekly report confirms its period; the brief states it.

## 6. What fyi provides

status relies on two things fyi added for it:

- `completed_at`, stamped when a task finishes. `updated_at` moves with
  every later edit, so "finished this week" read from it is wrong for
  anything touched again.
- Well-known tags (`decision`, `finding`, `learned`, `report`), listed in
  fyi's schema so every session uses the same words.

## 7. Not done

- **Posting to Slack.** The brief is copied and pasted. Slack data is
  often restricted, so posting is more likely a write-only webhook than
  a full integration.
- **A reports view in the fyi dashboard**, keyed on the `report` tag.
