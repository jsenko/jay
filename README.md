# jay

A Claude Code plugin marketplace for working across sessions. It
provides a durable store for tasks and notes, coordination between
sessions running at the same time, status reports, and coding and pull
request workflows. Each part is a separate plugin, so you install only
what you need.

**Status:** work in progress, and not yet usable. The plugins are
being moved here from an earlier single-install setup, one at a time.

## Plugins

| Plugin | What it does | Dashboard | Needs | State |
|---|---|---|---|---|
| fyi | Store for tasks, notes, projects and tracked PRs, as Markdown under `~/.fyi` | Today, pull requests, projects | — | planned |
| crew | Coordination between concurrent sessions: who is running, messages, and jobs | Sessions, jobs | — | planned |
| status | A short status for teammates and a weekly report, built from GitHub and fyi | — | fyi | planned |
| code | The coding role and workflow, with feature tracking and code-quality rules | — | fyi, crew | planned |
| pr-workflow | Watching GitHub, PR reviews, and the PR queue | — | fyi, crew | planned |

Each plugin's README covers its use and configuration; the links are
added as the plugins arrive. Installing a plugin also installs what it
needs. The dashboards of all installed plugins share one menu.

## Quickstart

Not yet available.

## Usage

Not yet available.

## Installing and managing plugins

Not yet available. This section will cover installing through Claude
Code's plugin system, updates, where files live (including `~/.jay`),
uninstalling, and opencode.

## Developing

See [CLAUDE.md](CLAUDE.md) for the repository layout and conventions,
and [docs/authoring.md](docs/authoring.md) for the rules on writing
instruction files.
