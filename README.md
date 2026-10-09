# jay

A Claude Code plugin marketplace for working across sessions. It
provides a durable store for tasks and notes, coordination between
sessions running at the same time, status reports, and coding and pull
request workflows. Each part is a separate plugin, so you install only
what you need.

**Status:** work in progress. fyi is available; the other plugins are
being moved here from an earlier setup, one at a time.

## Plugins

| Plugin | What it does | Dashboard | Needs | State |
|---|---|---|---|---|
| [fyi](plugins/fyi/README.md) | Store for tasks, notes, projects and tracked PRs, as Markdown under `~/.fyi` | Today, pull requests, projects | — | available |
| [crew](plugins/crew/README.md) | Roles to start sessions as, and coordination between them: who is running, messages, and jobs | Sessions, jobs | fyi | in progress |
| status | A short status for teammates and a weekly report, built from GitHub and fyi | — | fyi | planned |
| code | The coding role and workflow, with feature tracking and code-quality rules | — | fyi, crew | planned |
| pr | Watching GitHub, PR reviews, and the PR queue | — | fyi, crew | planned |

Installing a plugin also installs what it needs. The dashboards of all
installed plugins share one menu, so each one can open the others.

## Quickstart

You need [Claude Code](https://claude.com/claude-code), Node.js 18 or
later, and git. opencode support is planned.

```bash
git clone https://github.com/jsenko/jay.git
cd jay
./install.sh fyi
```

The installer adds the jay marketplace to Claude Code, installs the
plugin, lets sessions read `~/.jay` and, if you agree, use the plugin's
tools without asking each time. It then asks for the plugin's settings.
Restart Claude Code afterwards.

`./install.sh all` installs every plugin, and `./install.sh --help`
lists the options.

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
  `/crew:stop` saves where it stopped before it leaves.

Each plugin's README lists what it adds.

## Installing and managing plugins

### Without the installer

The installer runs these steps; you can run them yourself instead. In
Claude Code:

```
/plugin marketplace add jsenko/jay
/plugin install fyi@jay
```

Then add `~/.jay` to `permissions.additionalDirectories` in
`~/.claude/settings.json`, so sessions can read the plugins' files, and
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
| `~/.jay/config.json` | Settings shared by several plugins, once a plugin needs one |
| `~/.jay/roles/` | Your own roles, which crew finds next to the plugins' |
| `~/.jay/crew/` | crew's state: sessions, messages and jobs |
| `~/.fyi/` | fyi's items, and its own settings in `~/.fyi/config.json` |
| `~/.claude/settings.json` | Changed by the installer, which keeps the previous version as `settings.json.before-jay` |

### Uninstalling

```bash
./install.sh --uninstall fyi
```

or `/plugin uninstall fyi@jay`. Your items in `~/.fyi` and your settings
stay. Delete `~/.jay/plugins/fyi` to remove the link too.

### opencode

Not supported yet. The plan is for the same plugins to load in opencode
through an adapter, installed by the same `./install.sh`.

## Developing

`./install.sh --dev <plugins>` uses your clone as the marketplace, so
edits load on the next restart, and installs the plugins' npm
dependencies in place. See [CLAUDE.md](CLAUDE.md) for the
repository layout and conventions, and
[crew's authoring rules](plugins/crew/rules/authoring.md) for writing
instruction files.
