# status

Status reports written from what you actually did: your GitHub activity
and what you recorded in [fyi](../fyi/README.md).

- **`/status:brief`** gives a few bullets for your team, covering the days
  since your last brief, ready to paste into a channel.
- **`/status:weekly`** writes a prose report of your week for the wider
  organisation: what finished and why it mattered, decisions, and what
  comes next.

Both read the same gathering of the period, and differ in audience and
form. status needs only fyi, and has no settings.

## Installing

From a clone of jay:

```bash
./install.sh status
```

This installs status and fyi. Without a clone, in Claude Code:

```
/plugin marketplace add jsenko/jay
/plugin install status@jay
```

The [main README](../../README.md) covers the permissions to add then,
updating and uninstalling. The commands use the GitHub CLI, `gh`, logged
in as you, and only read: `gh search`, and `gh api` for reviews, commits,
events and Discussions. To skip a prompt for each one, allow
`Bash(gh search *)` and `Bash(gh api *)` in your Claude Code settings;
`gh api` can also write, so allow it only if you're comfortable with
that.

## Using it

```
/status:brief
/status:brief since Monday
/status:weekly
```

**The period** is worked out from the last report of the same kind: a
brief covers the days since the last brief, and a weekly report the
week after the last one. With no earlier report, a brief covers
yesterday and today, and a weekly report the seven days ending
yesterday. The weekly report confirms its period before starting. Pass
a period to choose your own.

**What is gathered:**

| From | What |
|---|---|
| GitHub, across every repository you can see | PRs you opened, merged and reviewed; issues you opened and closed; your comments on issues and PRs; GitHub Discussions you took part in |
| fyi | Tasks finished and blocked, notes written (decisions, findings, things learned), projects and their state |

There is no list of repositories to keep up to date: the commands search
GitHub for your activity wherever it happened.

**You are asked before anything sensitive goes in.** A status is about
the interesting things you did, so the commands ask, in one question,
about:

- activity that looks personal, such as a side project, which may or may
  not be worth sharing
- security work that isn't public yet: private security repositories,
  draft advisories, embargoed fixes
- anything where it isn't clear the team would care

Tell it a standing preference ("always include my parser project") and it
offers to remember it, as an fyi note tagged `decision` and `status`.

The weekly report also asks what's missing, such as meetings or work
that left no trace in a tool, before it writes.

## Where reports go

Each report is saved as an fyi note and printed in full for copying:

| Report | Title | Tags | Kept |
|---|---|---|---|
| Brief | `Status brief: <start> -- <end>` | `report`, `brief` | Archived after 14 days |
| Weekly | `Weekly report: <start> -- <end>` | `report`, `weekly` | Until you archive it |

Find them with `fyi_search` on those tags, or in the fyi dashboard.
Archived briefs are still found with `include_archived`. To have a
weekly report archived later, set `archive_after_days` on it.

Notes tagged `learned` show up in your briefs, so when you learn
something worth telling the team, say so and fyi records it.

## Building and testing

status is instructions only: two commands in `commands/`, the gathering
in `processes/gather.md` and what to share in `rules/sharing.md`.
`tools/check/check.sh` at the repository root checks their structure,
references and length. To try a change, install from a clone with
`./install.sh --dev status` and restart Claude Code.

The design is in [SPEC.md](SPEC.md).
