# pr

Handling more pull requests than one person can read. Reviews and
re-reviews happen without you, and you're asked only for what needs a
person: merging, closing, and real design questions.

- **The `watcher` role** follows GitHub: it tracks the PRs that concern
  you, unblocks what is stuck for mechanical reasons, and posts review
  work to the crew.
- **The `reviewer` role** takes that work: it reads the code properly,
  posts findings where that is safe, and drafts the rest for you. You can
  also review with it directly.
- **`/pr:queue`** gives you a prioritised batch of PRs waiting on you;
  **`/pr:checkout`** checks one out and briefs you on it.
- **The github-events server** watches repositories and pushes their
  activity to the watcher.

It needs [fyi](../fyi/README.md), where each tracked PR is a `pr` item,
[crew](../crew/README.md), for the roles and to pass review work
between sessions, and [code](../code/README.md), whose quality rules
reviews apply.

The processes are written for the Apicurio projects (see
[Adapting it](#adapting-it-to-another-project)).

## Installing

From a clone of jay:

```bash
./install.sh pr
```

This installs pr with fyi, crew and code, then asks for your GitHub
handle and the repositories to watch. Without a clone, in Claude Code:

```
/plugin marketplace add jsenko/jay
/plugin install pr@jay
```

and then run `~/.jay/plugins/pr/setup.sh` once a session has started.

The [main README](../../README.md) covers the permissions to add,
updating and uninstalling.

In opencode, `./install.sh --opencode pr` installs it from the clone;
the commands are `/pr-queue` and `/pr-checkout`, and the watcher polls,
since opencode has no channels.

## Using it

Run the watcher and a reviewer in sessions of their own, and keep using
your own sessions as usual:

```
/crew:start watcher
/crew:start reviewer
```

```
/pr:queue
/pr:checkout 1234
```

The watcher and reviewer act on their own (they are `unattended` roles).
What they may do without asking, and what always waits for you:

| Automatic | Needs you |
|---|---|
| Setting a milestone | Pushing to a contributor's branch |
| Re-running a workflow | Approving, merging, closing |
| Telling an author their DCO sign-off is missing | Taking a position on a design question |
| Requesting changes, when every blocking finding is verified, there is no design question, and the PR is at most moderately complex | Posting any other review: it waits as a draft on the `pr` item, for `/pr:checkout` |
| Posting a review with only optional findings, asking the author to choose for each | |
| Filing a follow-up issue the author asked for | |

Each of these is a GitHub write, and Claude Code's auto mode judges
each one unless it is allowed, sometimes refusing. `install.sh` offers
to allow exactly the commands the sessions run for them, and nothing
broader. None of them can approve:

| Write | Allow rule |
|---|---|
| Setting a milestone | `Bash(gh api -X PATCH repos/*/issues/* -F milestone=*)` |
| Re-running a workflow | `Bash(gh run rerun *)` |
| Commenting, as about DCO | `Bash(gh pr comment * --body-file *)` |
| Requesting changes | `Bash(gh pr review * --request-changes --body-file *)` |
| Posting a review with optional findings | `Bash(gh pr review * --comment --body-file *)` |
| Filing a follow-up issue | `Bash(gh issue create *)` |

Without them, a refused write isn't retried: a review waits as a draft
for `/pr:checkout`, and anything else is left for you, with a note
saying so.

Approval is never automatic. Talking to a reviewer session yourself
puts it in `focus`, so no other work is routed to it while you do.

## Notifications

Launch every session the same way, with the channels flag for both
plugins, as [Efficiency](../../README.md#efficiency) describes.

Every session runs its own github-events server, but **only a session
that asks for events polls GitHub**: the server starts on the first
`get_status` or `get_new_events`, which the watcher calls at startup.
Coder and reviewer sessions never do, so their servers make no GitHub
calls and push nothing, flag or not. `github_api` works everywhere.

In the watcher, GitHub activity arrives as pushes. Without the flag it
polls instead, which always works: every ten minutes after activity,
and less often while nothing happens, up to an hour. It can't otherwise
tell which it has, so after its first call the server pushes
`{"github":"hello"}`: a session that receives it stops polling.

## Settings

Your settings are in `~/.jay/config.json`, under `github`, written by
`setup.sh` (run it again to change them):

| Setting | Default | Used by |
|---|---|---|
| `user` | Your `gh` login | The rules, for what is yours: assigned, mentioned, authored |
| `repos` | `Apicurio/*`, `Apitomy/*`, `ApicurioTesting/*` | The server: what to watch. `owner/*` covers an owner's active repositories, refreshed hourly |

They live there, not in the plugin, because they're yours: another user
of the same plugin has a different handle and may watch other
repositories. The file is shared with other jay plugins.

The server's other settings are environment variables, for tests and
unusual setups: `GITHUB_REPOS` (wins over `repos`), `POLL_INTERVAL`
(seconds, default 180; 0 lets GitHub decide), `MAX_EVENT_AGE` (hours, default 24),
`STATE_FILE`, and `GITHUB_TOKEN` or `GH_TOKEN`.

**State** is in `~/.jay/pr/state.json`: where each repository's event
stream was last read. Delete it to start afresh; the next start then
delivers nothing old.

### Credentials

The server and the sessions act on GitHub **as you**, with your `gh`
login and its scopes:

- **The server** takes `GITHUB_TOKEN`, then `GH_TOKEN`, and otherwise
  asks `gh auth token` for github.com. No token is written into any
  configuration, and a rotated token needs no reinstall.
- **Sessions** run `gh` commands as the same login.

So whatever your login may do, the watcher and reviewer may do, limited
only by the rules above. A fine-grained, read-only token for the server
is planned, not built.

### Adapting it to another project

The project conventions are in
[`rules/apicurio-prs.md`](rules/apicurio-prs.md): where maintainers and
reviewer assignment are declared, maintainer-only labels, and the
`lifecycle/*` labels that drive PR state. `rules/pr-interest.md` tracks
what is assigned to you, so it assumes the project assigns reviewers
automatically. A project without lifecycle labels needs
`processes/pr-events.md` changed as well. Making this configurable is a
follow-up, waiting for users outside Apicurio.

## The server

| Tool | Gives |
|---|---|
| `get_new_events` | Events not returned before, with bodies cut to 200 characters, and when to poll next |
| `get_event` | One event in full |
| `github_api` | Any GitHub API URL, cached |
| `get_status` | The user, repositories, last success per source and recent errors, to tell "nothing happened" from "polling is broken" |

It watches PRs, reviews, review comments, issues and issue comments in
the watched repositories, completed workflow runs and runs waiting for
approval, and notifications you take part in elsewhere. A first start
only records where each stream is; after that, each event is delivered
once, including those from while it was down, up to the age limit.

## Building and testing

```bash
cd plugins/pr
npm install
npm test
```

The tests run the server against a fake GitHub API on a local port
(`GITHUB_API_URL`), so they need no network or token. The instructions
are checked by `tools/check/check.sh` at the repository root.

The design is in [SPEC.md](SPEC.md).
