# CLAUDE.md

## What this repo is

jay: a Claude Code plugin marketplace for multi-session workflows. Each
plugin is installed on its own, and opencode loads the same plugin
folders through an adapter.

## Repository structure

- `.claude-plugin/marketplace.json` — the marketplace: every plugin, with its `source`
- `plugins/<name>/` — one plugin, in Claude Code's layout:
  - `.claude-plugin/plugin.json` — name, version, `dependencies`
  - `commands/`, `skills/` — what Claude Code loads, namespaced as `<plugin>:<name>`
  - `rules/`, `processes/`, `roles/` — instruction files, read through `~/.jay/plugins/<name>/`
  - `hooks/` — the link hook: a symlink to `tools/plugin/hooks/`
  - `.mcp.json`, `package.json`, `server/` — an MCP server, if the plugin has one
  - `dashboard/` — a dashboard, if it has one, built on the shell, with `shell` and `run.sh` symlinked from `tools/plugin/dashboard/`
- `install.sh` — installs plugins into the clients found, sets permissions, and runs each plugin's `setup.sh`
- `tools/` — repo tooling: `check/`, and `plugin/` for the pieces every plugin links to
- `.github/workflows/` — CI: `tools/check`, shellcheck and plugin tests on each push to main

A marketplace install copies only the plugin's folder. Everything a
plugin needs at runtime lives inside it.

## File types and when to use each

### Commands
Something the user invokes by name. Defines *what* to do and *when*, and
delegates *how* to processes and rules. A command that explains a
procedure has taken on a process's job.
- Frontmatter: `---\ndescription: ...\nargument-hint: ...\n---`
- Keep focused on the action and workflow flow, not detailed steps.
- Write cross-references in Claude's form, `/<plugin>:<command>`; the opencode adapter rewrites them.

### Processes
Repeatable, self-contained sets of steps for taking actions. Each process
file has a start section describing when and how it starts.
- Used for shared workflows referenced by multiple commands.
- Techniques: tables for complex state transitions instead of prose;
  event → action format; crew jobs for chaining workflows between
  sessions.
- A session reading just that file should know what to do.

### Rules
Definitions of concepts or general guidelines. Describe *what* and *why*,
not exactly *how*, which belongs in processes.
- Format specs, criteria, conventions, constraints.
- Single source of truth for their domain.

### Skills
Triggers for workflows based on conversation context, not direct
invocation like a command.

### Roles
A profile for a kind of session: what it is for, what it advertises to
the crew, which rules and processes it loads at start versus on demand,
and how autonomously it acts. Each role ships in the plugin that owns
it, and sessions find roles under `~/.jay/plugins/*/roles/`, and the
user's own under `~/.jay/roles/`.

## References

Instruction files name each other by stable path, never relative to the
plugin: `~/.jay/plugins/<plugin>/<dir>/<file>.md`. `${CLAUDE_PLUGIN_ROOT}`
appears only in `.mcp.json` and hooks, where both clients substitute it.
A reference into another plugin needs that plugin in `dependencies`.
crew's `rules/authoring.md` has the full table, and `tools/check` enforces it.

## Design principles

### Split and reference
Split repeatable and self-contained parts into separate files. Reference
other rules and processes instead of duplicating content. This keeps each
file concise, maintains readability, and saves context — files are only
loaded when needed. Even conditional references are valuable: they keep
a whole file out of every load where the condition is false.

### Avoiding duplication
1. Check if an existing file already covers part of the functionality.
2. If two commands need the same workflow, extract it into a process.
3. If two commands need the same definitions, extract into a rule.
4. When a command overrides part of a referenced process, that's a sign
   the process should have a mode or variant instead.

### Event → action format
When documenting workflows that react to events, use a consistent format:

```
### <Event name>

**Source:** <where the event comes from> → <who receives it>
**Processed by:** <which session/command handles it>

1. Action step
2. Action step
```

Always name the source explicitly, so every event has a clear emitter
and processor.

### Conciseness and chunking
Follow `plugins/crew/rules/authoring.md` for any instruction file. It
sets per-type line budgets, which `tools/check` enforces. The right
chunk is a **load boundary, not a topic**: when half a file applies only
under a condition, that is two files.

Users follow the same guide for their own roles and rules, so keep it
free of anything only this repository needs.

### Independent plugins
A plugin never imports another plugin's code or reads its data files.
What two plugins share lives once in `tools/plugin/`, and each plugin
links to it with a relative symlink; a marketplace install copies the
files in. `tools/check` fails when a link is missing. Shared state goes through the owning plugin's
MCP tools.

### Code style
Applies to code in `plugins/*/server/`, `plugins/*/dashboard/` and `tools/`.

**Document every declaration.** Each exported function, class, type, and
interface gets a doc comment, even a single line. Non-exported helpers
too, unless the name genuinely says everything (`nowIso`, `slug`). Say
why the thing exists or what a caller needs to know, not what the
signature already shows.

**One purpose per file.** Prefer many small files over a few large ones.
A banner comment separating sections of a file marks a seam that should
be a file boundary. Group related files in a subdirectory.

## Documentation

This repo is intended to become public. Write for a reader who is not the
author and has not seen it before.

- **Top-level `README.md`:** the entry point, in this order:
  1. a short intro, with a table of the plugins, their dashboards and dependencies, linking each plugin's README
  2. a quickstart install
  3. a usage overview with a few examples
  4. installing and managing plugins in detail: the plugin system, updates, where files live (`~/.jay`, the plugin cache, `~/.fyi`), uninstalling, and opencode
- **One `README.md` per plugin:** what it is, how to use it, how to build and test it, and how to configure it. A phase that adds a plugin adds its README, and its rows and examples in the top-level README.
- **Design rationale** goes in the plugin's `SPEC.md`, not its README.
- **Update docs in the same change as the behaviour.** Be explicit about what is built versus planned; never describe intended behaviour in the present tense.

## Testing changes

- `tools/check/check.sh` — structure, references, budgets; CI runs it on every push to main.
- `npm test` in each plugin that has a `package.json`.
- To try plugins in Claude Code, run `./install.sh --dev <plugins>`: it adds the checkout as the `jay` marketplace and runs `npm install` in each plugin. Plugins load in place, so a restart picks up edits.
- Keep one `jay` marketplace. Marketplace names are global, so adding a second source under the same name repoints it everywhere.
