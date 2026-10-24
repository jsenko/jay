# A day with jay

How the plugins fit together over a working day: what to start, what to
say, and what happens without you. Each step links to the plugin's
README for the details.

Command names here are Claude Code's. In opencode, `/crew:start` is
`/crew-start`, and so on ([README](README.md#opencode)).

## Once: install and launch

```bash
git clone https://github.com/jsenko/jay.git
cd jay
./install.sh all
```

The installer asks for fyi's default scope, and for your GitHub handle
and the repositories to watch. Restart your client afterwards.

Launch Claude Code with the channels flag, so the crew and GitHub can
wake a session instead of it polling on a timer:

```bash
claude --dangerously-load-development-channels plugin:crew@jay plugin:pr@jay
```

Use it for every session; an alias saves typing it. Only a session that
watches GitHub actually polls it, so the flag costs the others nothing
([pr](plugins/pr/README.md#notifications)).

## Morning: what needs me?

Start the sessions that work without you, each in a terminal of its own:

```
/crew:start watcher
/crew:start reviewer
```

The watcher follows the repositories you watch, tracks the pull requests
that concern you, and posts review work to the crew. The reviewer takes
it, reads the code, and either posts findings or drafts them for you.
Neither approves, merges or pushes anything
([pr](plugins/pr/README.md#using-it)).

Then, in any session:

- **"What needs me today?"** gives due tasks, pull requests waiting on
  you, blocked work and active projects
  ([fyi](plugins/fyi/README.md)).
- **`/pr:queue`** gives the few pull requests that need a person now,
  quick wins and the longest-waiting first.
- **`/fyi:dashboard`** shows the same as a web page. Its menu also opens
  crew's dashboard: who is running, and what work is waiting.

## Working on code

In a checkout:

```
/crew:start coder
```

The coder finds the project linked to this directory and says where the
last session stopped. Then describe the work, or point at an issue:

```
/code:implement #1234
/code:implement make the retry back off exponentially
```

It picks how much tracking the work needs: none for a fix, a design note
for a feature, phases for something spanning several pull requests. It
builds after each change, checks its diff against the quality rules
(citing them by ID, such as `Q7`), and asks before committing. It never
pushes without asking ([code](plugins/code/README.md)).

Along the way, say what is worth keeping:

- **"Remember that we chose Postgres for the JSON queries."** becomes a
  decision note on the project.
- **"Remind me on Monday to check the migration."** becomes a task.

When you stop, `/crew:stop` saves where the work stands. Tomorrow, from
this or any other directory, **"pick up the storage project"** brings it
back, and `/crew:start coder` in the same repository offers to continue
the session itself ([crew](plugins/crew/README.md#roles)).

## Reviewing

- **`/pr:checkout 1234`** checks a pull request out and briefs you: what
  it does, what the reviewer found, and what is left for you to decide.
  On a simple PR the reviewer may already have requested changes, or
  posted optional findings for the author to choose from. Any other
  review waits as a draft, posted only with your verdict. Nothing is
  ever approved for you.
- **Or talk to the reviewer session** directly. It takes the review with
  you, and while you are there no other work is routed to it.

## Several sessions at once

Sessions see each other through the crew. One can post work for whoever
can take it ("post a job to investigate the flaky test"), or send another
a message. A session you are working in is marked `focus`, so work isn't
routed into it behind your back ([crew](plugins/crew/README.md#coordination)).

## Statuses

- **`/status:brief`**, every couple of days: a few bullets for your team,
  covering what you did since the last brief, ready to paste. It tells
  you what it will say and asks what's missing: chat, meetings, time off.
- **`/status:weekly`**, once a week: the week as prose for a wider
  audience, saved to fyi.

Both search GitHub for your activity, and ask before including anything
that looks personal or isn't public yet ([status](plugins/status/README.md)).

## When something goes wrong

| What you see | What to do |
|---|---|
| A response was refused as too large | `/crew:retry-smaller` redoes the work in smaller pieces |
| "The fyi store is in format N, newer than this fyi reads" | A newer fyi, perhaps in your other client, migrated the store: update fyi there too |
| A session can't find `~/.jay/plugins/…` | Hooks didn't run; check they aren't disabled, and restart |
| The watcher reports nothing | Ask it for `get_status`: it says whether polling works and when each source last succeeded |
| A milestone wasn't set, or a review was drafted though it could have been posted, and the session says a write was refused | Auto mode refused it; allow the writes as the [pr README](plugins/pr/README.md#using-it) says |
