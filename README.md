# jay

A Claude Code plugin marketplace for working across sessions. It
provides a durable store for tasks and notes, coordination between
sessions running at the same time, status reports, and coding and pull
request workflows. Each part is a separate plugin, so you install only
what you need.

## Plugins

| Plugin | What it does | Dashboard | Needs |
|---|---|---|---|
| [fyi](plugins/fyi/README.md) | Tasks, notes, projects and tracked PRs, stored as Markdown in `~/.fyi` | Today, pull requests, projects | — |
| [crew](plugins/crew/README.md) | Start each session in a role, and let sessions work together: see who is doing what, send messages, and hand off jobs | Sessions, jobs | fyi, timer\* |
| [status](plugins/status/README.md) | A short status for teammates and a weekly report, written from your GitHub activity and fyi | — | fyi |
| [code](plugins/code/README.md) | A coder role, one command for changes of any size, tracked as much as each needs, and code-quality rules with stable IDs | — | fyi, crew, timer\* |
| [pr](plugins/pr/README.md) | A watcher that follows GitHub for you, a reviewer role, and a queue of the PRs waiting on you | — | fyi, crew, code, timer\* |
| [timer](plugins/timer/README.md) | Timers for opencode sessions, so they can poll and check back on their own. Claude Code has its own | — | — |

\* In opencode only, where sessions poll for work on its timers. Claude
Code has timers built in, so timer isn't a declared dependency, and
installing these doesn't install it: add it with
`./install.sh --opencode timer`, or install `all`.

Installing a plugin also installs what else it needs. The dashboards of all
installed plugins share one menu, so each one can open the others.
The first five work in Claude Code and in opencode; timer is for opencode
only, and the installer skips it for Claude Code.

### Written for Apicurio first

jay's first users work on the Apicurio projects, so parts of code and pr
follow their conventions:

| Part | What is Apicurio's | Elsewhere |
|---|---|---|
| code, `rules/apicurio.md` | The A rules | Loaded only in Apicurio and Apitomy repositories |
| pr, watched repositories | `Apicurio/*`, `Apitomy/*` and `ApicurioTesting/*` by default | The `github.repos` setting |
| pr, `rules/apicurio-prs.md` | Maintainers and reviewer assignment read from `.github/pr-lifecycle.yml`, maintainer-only labels, `lifecycle/*` labels driving PR state, and the `Verification Gate` check read as pending | Needs a version of the file for the project |
| pr, `rules/pr-interest.md` | Tracking what is assigned to you, which assumes reviewers are assigned automatically | Needs changing for a project that doesn't |
| pr, `server/filters.ts` | The project's bot account, ignored | Hard-coded |

Making pr fit any project is planned
([pr](plugins/pr/README.md#adapting-it-to-another-project)).

## Quickstart

You need [Claude Code](https://claude.com/claude-code) or
[opencode](https://opencode.ai), Node.js 18 or later, and git.

```bash
git clone https://github.com/jsenko/jay.git
cd jay
./install.sh fyi
```

The installer adds the jay marketplace to Claude Code, installs the
plugin, lets sessions read `~/.jay` and read and write fyi's project
folders, and, if you agree, use the plugin's tools without asking each
time ([Permissions](#permissions)). It then asks for the plugin's
settings. Restart your client afterwards.

If opencode is installed, the installer sets it up too. opencode has no
plugin marketplace, so it loads the plugins straight from this clone:
keep the clone where it is, and `git pull` in it to update
([opencode](#opencode)).

`./install.sh all` installs every plugin, and `./install.sh --help`
lists the options. If you install crew or pr, launch Claude Code with
the channels flag ([Efficiency](#efficiency)).

## Usage

Talk to a session as usual; the plugins give it tools and habits.

- **"Remember that we chose Postgres because of the JSON queries."**
  The session records a decision note, attached to the project you are
  working on.
- **"What needs me today?"** It lists tasks that are due, pull requests
  waiting on you, and active projects.
- **"Remind me on Monday to follow up on the migration."** It creates a
  task due on Monday.
- **"Pick up the storage project."** It reads where the last session
  stopped, what was decided and why, and what is still open, from any
  directory.
- **`/fyi:dashboard`** opens the same information as a web page.
- **`/crew:start coder`** starts a session as the coder role: it joins
  the crew, reads what the role lists, and says what it found. Other
  sessions see what it is doing, and work it can take is routed to it.
  `/crew:stop` saves where it stopped before it leaves, and the next
  `/crew:start` offers to pick it up.
- **`/status:brief`** writes a few bullets on what you did since your
  last brief, ready to paste into your team's channel, and asks first
  about anything personal or not yet public. **`/status:weekly`** writes
  the week as prose for a wider audience, and saves it to fyi.
- **`/code:implement make the retry back off exponentially`** works on
  the change in a loop of building and checking its own diff against
  the code-quality rules, with a design note or phases when the work is
  big enough to need them. It asks before committing and never pushes
  without asking.
- **`/crew:start watcher`** and **`/crew:start reviewer`**, each in a
  session of its own, follow GitHub and review the PRs that concern you
  without you; **`/pr:queue`** then gives you the few that need a person.

Each plugin's README lists what it adds, and [GUIDE.md](GUIDE.md) walks
through a working day with all of them.

## Installing and managing plugins

### Efficiency

Sessions that coordinate spend tokens while they wait for work. Two
things keep that low.

**Launch with channels: strongly recommended** with crew or pr. Claude
Code then wakes a session when something arrives, from the crew or from
GitHub, so a waiting session costs nothing:

```bash
claude --dangerously-load-development-channels plugin:crew@jay plugin:pr@jay
```

Name only the installed plugins: `plugin:crew@jay` alone without pr.
Claude Code asks you to confirm at each start. A setting can't replace
the argument: the allowlist that would is read only from managed
settings, which need root. An alias saves the typing:

```bash
alias claude-jay='claude --dangerously-load-development-channels plugin:crew@jay plugin:pr@jay'
```

**Without channels, polling adapts.** A session checks on a timer: ten
minutes after anything happens, ten more after each check that finds
nothing, up to an hour. opencode has no channels, so it always polls,
on timers from the [timer](plugins/timer/README.md) plugin.
The bounds are minutes in `~/.jay/config.json`:

```json
{ "polling": { "min": 10, "step": 10, "max": 60 } }
```

Only sessions that take work set a timer at all: a role with no
capabilities, such as `general`, waits for you, and only the watcher
polls GitHub. The watcher polls crew and GitHub on one timer, so each
check costs one turn.

### Permissions

Plugins can't grant themselves permissions, so the installer adds them
to `~/.claude/settings.json`, keeping the previous file as
`settings.json.before-jay`. Uninstalling a plugin removes its rules
again.

| Permission | For | When |
|---|---|---|
| `~/.jay` in `additionalDirectories` | Reading the plugins' instruction files | Always |
| `Read(~/.fyi/*/projects/**)`, `Edit(~/.fyi/*/projects/**)` | fyi: a project's plans and design notes, in its folder | Always |
| `mcp__plugin_<plugin>_<server>` | The plugins' MCP tools, without asking each time | If you agree |
| Six `Bash(gh …)` rules | pr: the GitHub writes its sessions make unattended, such as setting a milestone or posting a review, each in one exact form and none able to approve | If you agree |

The [pr README](plugins/pr/README.md#using-it) lists the six `gh`
rules. Without them, auto mode may refuse those writes: a review then
waits as a draft, and anything else is left for you.

In opencode, the plugins allow their own directories (`~/.jay`, and
fyi's project folders) when they load. Tools and commands follow your
opencode permission settings.

### Without the installer

The installer runs these steps; you can run them yourself instead. In
Claude Code:

```
/plugin marketplace add jsenko/jay
/plugin install fyi@jay
```

Then add the permissions marked "Always" in [Permissions](#permissions)
to `~/.claude/settings.json`, and any of the others you want, and
restart. After the first session has started, run a plugin's settings
script, such as `~/.jay/plugins/fyi/setup.sh`.

### Updating

Run `./install.sh <plugins>` again: it updates the plugins and keeps your
settings. Without the installer, run `/plugin marketplace update jay`,
then `/plugin update fyi@jay`. Restart Claude Code either way.

### Where files live

| Path | Holds |
|---|---|
| `~/.claude/plugins/cache/jay/<plugin>/<version>/` | The installed plugins, managed by Claude Code |
| `~/.jay/plugins/<plugin>` | A link to each plugin's current version, made when a session starts; instruction files refer to each other through it |
| `~/.jay/config.json` | Settings shared by several plugins: `github.user` and `github.repos`, written by pr's setup |
| `~/.jay/roles/` | Your own roles, which crew finds next to the plugins' |
| `~/.jay/crew/` | crew's state: sessions, messages and jobs |
| `~/.jay/pr/` | github-events' state: where each repository's event stream was last read |
| `~/.fyi/` | fyi's items, and its own settings in `~/.fyi/config.json` |
| `~/.claude/settings.json` | Changed by the installer, which keeps the previous version as `settings.json.before-jay` |

### Uninstalling

```bash
./install.sh --uninstall fyi
```

or `/plugin uninstall fyi@jay`. The installer also removes the
permissions it added for the plugin. Your items in `~/.fyi` and your
settings stay. Delete `~/.jay/plugins/fyi` to remove the link too.

### opencode

The same plugins load in opencode, from your clone: `./install.sh`
configures opencode when it finds it, or only opencode with
`--opencode`. It writes one small file per plugin into
`~/.config/opencode/plugins/`, pointing at the plugin in the clone, so
keep the clone where it is, and `git pull` there to update.

What differs from Claude Code:

| | Claude Code | opencode |
|---|---|---|
| Commands | `/crew:start` | `/crew-start`: opencode doesn't group commands by plugin, so each is prefixed with its plugin's name |
| Skills | `code:style` | `code-style`, for the same reason |
| Tool names | `mcp__plugin_fyi_fyi__fyi_capture` | `fyi_fyi_capture`, as before jay |
| Notifications | Pushed, with the channels flag | Polled every 10 to 60 minutes: opencode has no channels. Polling needs a timer, which the [timer](plugins/timer/README.md) plugin provides |
| Instructions for every session | `~/.claude/CLAUDE.md` | `AGENTS.md` |

jay's files are written once, with Claude Code's names. When opencode
loads a plugin, its commands and skills are registered under opencode's
names, with the references inside them rewritten, so `/crew:start` in a
command reads `/crew-start`. opencode takes a skill's name from its
file, so each skill is renamed by writing a copy of its `SKILL.md` to
`~/.local/share/jay/<plugin>/opencode-skills/`; its other files link
back to the clone. Rules and processes, which sessions read when they
need them, keep Claude Code's names, and the table above maps them.

## Developing

`./install.sh --dev <plugins>` uses your clone as the marketplace, so
edits load on the next restart, and installs the plugins' npm
dependencies in place. See [CLAUDE.md](CLAUDE.md) for the
repository layout and conventions, and
[crew's authoring rules](plugins/crew/rules/authoring.md) for writing
instruction files. Plugins are released by a workflow run by hand,
with the new version of each ([CLAUDE.md](CLAUDE.md#releasing)).

## License

[Apache License 2.0](LICENSE).
