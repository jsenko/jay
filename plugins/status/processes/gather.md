# Gather a period

One gathering of the user's activity over a period, which both status
commands read, ending with a check-in with the user. The result is a
digest kept in the session, not saved.

## Start

Run by `/status:brief` and `/status:weekly` once the period is settled:
a start and an end date, both inclusive.

## Preferences

Before anything else, read the user's standing choices: `fyi_search`
for notes with `where: {tags: {all: ["decision", "status"]}}`. They say
what to always include or leave out, and how the user's periods run.

## GitHub

Search all of GitHub as the user (`@me`), never a list of repositories.
`<range>` is `<start>..<end>`. Prefix calls with `GH_HOST=github.com`
only when `gh auth status` lists another host; without the prefix, the
user's allow rules for `gh` still match.

| What | Search, then keep |
|---|---|
| PRs authored | `gh search prs --author=@me --updated=<range>`; those opened, merged or closed in the period, or with the user's commits in it |
| PRs reviewed | `gh search prs --reviewed-by=@me --updated=<range>`; those with a review by the user in the period (`gh api …/pulls/<n>/reviews`) |
| Issues authored | `gh search issues --author=@me --updated=<range>`; those opened or closed in the period |
| Commits pushed without a PR | `gh api users/<login>/events`, push events in the period, for the repositories; then `gh api "repos/<repo>/commits?author=<login>&since=<start>&until=<end + 1 day>"`, minus commits in a PR above |
| Comments | `gh search issues --commenter=@me --include-prs --updated=<range>`, minus what is above; read the user's comments in the period on each |
| GitHub Discussions | `gh api graphql`, `search(type: DISCUSSION)` with `involves:<login> updated:<range>` |
| Private | the authored and comment searches again with `--visibility=private`, and push events with `public: false`, to mark which items are private |

Use `--limit 100`, and say so when a search fills it.

For each conversation, record what it was about and what came of it: a
question answered, a design settled, a contributor unblocked. Who it was
with matters; how many comments does not.

Drop authors ending in `[bot]`.

## fyi

All in the default scope, with `include_archived: true` where the
period's items may have archived since.

| What | Call |
|---|---|
| Tasks finished | `fyi_search`, type task, `where: {completed_at: {after: <start>, before: <end>}}` |
| Tasks blocked | `fyi_search`, type task, `where: {status: "blocked"}`, with `blocked_on` |
| Coming up | `fyi_today` |
| Notes written | `fyi_search`, type note, `where: {created_at: {after: <start>, before: <end>}}`, grouped by the tags `decision`, `finding` and `learned` |
| Projects | active ones, with `current_state`; and those finished in the period, by `completed_at` |

Leave out notes tagged `report`: those are earlier statuses.

## Digest

One line per item, with its link, under these headings:

| Heading | Holds |
|---|---|
| Done | PRs merged, issues closed, tasks and projects finished |
| In progress | PRs open, and what each waits on |
| With others | Reviews, discussions and comments, with what came of each |
| Decided and learned | `decision`, `finding` and `learned` notes |
| Blocked | Blocked tasks, with what they wait on |
| Next | Issues the user opened, as the work they plan; due tasks; each active project's next step |

Mark each item `private` when it came from a private repository, and
`personal` when its repository is outside the organisations most of the
period's work is in. `~/.jay/plugins/status/rules/sharing.md` decides
what those marks mean.

## Check in

Before writing, one message to the user:

1. **What the status will say:** the main points in a couple of
   sentences, not the digest.
2. **What to share:** the questions `sharing.md` says to ask.
3. **What is missing:** anything that left no trace in GitHub or fyi,
   such as news from chat or email, meetings, offline work, or time off.

Take what the user adds at the level they give it. "I was off on Friday"
or "mostly calls with the Data Models team" goes in as said. Ask a
follow-up only when the status can't say it without one, such as what
came of a conversation the user names, and at most one round of them.
