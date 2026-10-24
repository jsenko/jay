# fyi

A durable store for tasks, notes, projects and tracked pull requests,
for Claude Code and opencode sessions. Every item is a Markdown file
under `~/.fyi`, which you can open and edit like any other file; the
plugin gives sessions tools to capture, find and update items without
editing those files themselves.

It is what other jay plugins build on: status reports read it, and the
coding and PR workflows record their state in it.

## Installing

From a clone of jay:

```bash
./install.sh fyi
```

This installs the plugin and asks for its settings (see
[Configuration](#configuration)). Without a clone, in Claude Code:

```
/plugin marketplace add jsenko/jay
/plugin install fyi@jay
```

then follow the [main README](../../README.md#without-the-installer)
for permissions and settings. It also covers updating and uninstalling.

In opencode, `./install.sh --opencode fyi` installs it from the clone,
and `/fyi:dashboard` is `/fyi-dashboard` there.

## What sessions can do

| Tool | Purpose |
|---|---|
| `fyi_capture` | Create a task, note, project or PR record |
| `fyi_search` | Find items by type, text, and conditions on any field |
| `fyi_get` | Read one item in full |
| `fyi_update` | Change fields on an existing item |
| `fyi_today` | What needs attention now, in one call |
| `fyi_link` | Relate two items; the inverse link is written too |
| `fyi_handoff` | Pick up a project where the last session stopped |
| `fyi_convert` | Turn one item into another type, keeping where it came from |
| `fyi_create_scope` | Create a scope |

The plugin also brings a skill, `fyi-triggers`, that has sessions notice
when something is worth keeping: a decision, work left for later, a fact
that took effort to find.

## Dashboard

A local web page over the store: what needs you today, which pull
requests are waiting, and what projects are in flight.

Run `/fyi:dashboard` in a session to start it and get the link, or use
its script in a terminal:

```bash
~/.jay/plugins/fyi/dashboard/run.sh                # run it here, on http://localhost:3456
~/.jay/plugins/fyi/dashboard/run.sh start --open   # in the background, and open a browser
~/.jay/plugins/fyi/dashboard/run.sh stop           # stop it, however it was started
~/.jay/plugins/fyi/dashboard/run.sh status         # the URL, if it is running
```

| View | Lists |
|---|---|
| Today | Tasks due or overdue, then the next fortnight |
| Pull requests | Those needing you, then those waiting on others; within each, by importance, then oldest |
| Projects | Active, then paused, with where each one stopped |

Click an item for its details; ✕ or Esc closes them. A pull request
shows what its review found, your review, the author's response, CI,
and its attention items by whose move they are, yours first. Tasks can
be marked done or snoozed by a day or a week; everything else is
read-only. The page refreshes every 30 seconds.

The scope selector beside the heading shows every scope or one, and the
browser remembers the choice. An item outside the default scope carries
its scope as a chip.

The menu also lists the views of other installed plugins that have a
dashboard; choosing one opens that plugin's dashboard, starting it if
needed. The counts beside views are only what wants attention.

The dashboard listens on this machine only (127.0.0.1) and has no login,
so any program running on this machine can reach it. It reads `FYI_DIR` like
the server does.

## Item types

| Type | For | Required |
|---|---|---|
| `task` | Something that needs doing | `title`, `next_action_at` |
| `note` | Worth remembering, including a decision and its reasoning | `title`, `content` |
| `project` | Work spanning more than one session | `title`, `description` |
| `pr` | A tracked pull request | `title`, `url` |

**A task must have a next action date.** A task with no next action is a
note, and the server says so rather than accepting an item that will
never be looked at again.

**Notes carry decisions.** A note with a `project` and the `decision`
tag is an entry in that project's decision log, which `fyi_handoff`
reads back in date order.

**Some tags are well-known**, and other tools and plugins rely on what
they mean:

| Tag | Means |
|---|---|
| `decision` | A decision and its reasoning, on a note with a project |
| `finding` | A fact established by investigating |
| `learned` | Something learned that is worth sharing with the team |
| `report` | A generated report, such as a status |
| `meta` | Friction with the instructions themselves |

They are listed in the `tags` field description, so every session sees
them. Any other tag is free-form.

**Items archive themselves.** A task 14 days after it is done, a PR 7
days after it merges or closes, a project 30 days after it finishes, and
a project's notes with it, each counted from `completed_at`, when it
finished. A note with no project stays until archived by hand
(`archived: true`), or until `archive_after_days` after its last change
when that is set. Archived items move to
`<scope>/archive/<type>/`, where `fyi_get` still finds them and
`fyi_search` does with `include_archived`. Nothing is deleted. Set
`pinned: true` to keep something active regardless, or
`archive_after_days` to change its window.

**A pull request can be out of date.** A `pr` mirrors GitHub, so it
records `synced_at`, when it was last confirmed against GitHub, and
every read warns once that is too old. fyi never contacts GitHub itself;
the session that re-reads the PR updates it with `synced: true`.

**A `pr` is named after its URL**, as `pr-<repo>-<number>`, and the same
PR cannot be captured twice. **Everything else is named after its
title**, or after `slug` when you pass one. Ids never change, because
links and messages point at them.

**References must resolve.** A field holding another item's id, such as
`project`, is checked on every write, so a typo is an error rather than
an item that silently belongs to nothing.

## Scopes

Items live in a scope, each its own directory under `~/.fyi`. Every
store has `default`, `work` and `personal`; any other directory there is
a scope too, so you can keep one per job, client or side project. Ask a
session to create one, or `mkdir ~/.fyi/<name>`: lowercase letters,
digits and hyphens. `attachments` and dot-directories, such as `.git`,
are not scopes.

Calls that name no scope use the default scope, which is `default`
unless [configured](#configuration) otherwise. Pass `scope` to use
another; searches also take a list, such as `["work", "personal"]`, or
`"all"`. A scope that doesn't exist is refused, so a typo never starts a
new one.

To move an item, set its `scope` with `fyi_update`. It keeps its id, so
links to it still work. A project brings its tasks and notes from the
scope it leaves, and its folder, leaving a link at the old path so
checkouts linked there keep working. A project's handoff finds its
tasks and notes in any scope.

A scope is separate from a `pr`'s `repo` field, which is its
`Owner/Repo` on GitHub.

## Examples

```jsonc
fyi_capture({
  type: "task",
  title: "Fix the retry on startup",
  description: "Topic metadata is not ready when verification runs.",
  next_action_at: "2026-09-24",
  priority: "high"
})
// → { id: "task-fix-the-retry-on-startup", path: "~/.fyi/default/task/...md" }

fyi_capture({ type: "pr", title: "fix: retry", url: "https://github.com/acme/widgets/pull/8676" })
// → { id: "pr-widgets-8676", ... }

fyi_search({ type: ["task"], where: { next_action_at: { before: "2026-09-30" } } })
fyi_search({ where: { "attention_items.type": "decide" } })
fyi_update({ id: "task-fix-the-retry-on-startup", status: "in-progress" })

// One entry of a list, leaving entries other sessions wrote alone:
fyi_update({ id: "pr-widgets-8676",
  remove: { attention_items: { type: "review" } },
  add: { attention_items: [{ type: "decide", description: "Which cache?" }] } })

fyi_today()                                  // due, upcoming, blocked, PRs, projects
fyi_handoff({ project: "project-storage" })
```

### Search conditions

`where` maps a field to a condition; several combine with AND.

| Condition | Matches when |
|---|---|
| `"x"` | the field equals it |
| `["x", "y"]` | it equals any of them |
| `{contains: "x"}` | a string field holds it, ignoring case |
| `{all: ["x", "y"]}` | a list field holds every one |
| `{before, after}` | inside the range, inclusive — dates or numbers |
| `{exists: true}` | the field is present; `false` for absent |

Paths may be dotted, and a list on the way matches when any element
does: `"attention_items.type": "decide"`. An unknown field or operator
is an error, never an empty result.

## Files

One file per item, `~/.fyi/<scope>/<type>/<id>.md`:

```
~/.fyi/
  config.json                         # settings, see below
  store.json                          # the store's format version, kept by fyi
  default/
    task/task-fix-the-retry-on-startup.md
    note/note-chose-varnish-over-a-cache.md
    project/project-storage.md
    projects/storage/                   # the project's folder, for its files
    archive/
      task/task-ship-the-release-notes.md   # archived, still searchable
```

**Each project has a folder** for files that belong to it rather than to
any one item: plans, design notes, phase files. `fyi_capture`, `fyi_get`
and `fyi_handoff` give its path as `folder`, so other plugins and roles
never build it themselves. It is named after the project id without
`project-`, and is created when first asked for; an archived project
keeps the folder it had.

**`store.json` records the store's format**, which fyi keeps up to date
itself: a release that changes the format migrates the store when it
starts. If a session says the store is in a newer format than fyi reads,
a newer fyi, perhaps in your other client, has already migrated it.
Update the fyi plugin where it is older; until then that client can read
the store but not change it.

Fields are YAML frontmatter, and the one long text field of each type is
the Markdown body. You can create, edit and delete files by hand: the
server picks the change up on its next call, and keeps fields you added.
After editing by hand, `npm run check` in the plugin's folder
(`~/.jay/plugins/fyi`) reports anything that no longer fits, without
changing files.

## Configuration

| Setting | Where | Default | Purpose |
|---|---|---|---|
| `defaultScope` | `~/.fyi/config.json` | `default` | The scope calls use when they name none: `default`, `work`, `personal`, or one of your own |
| `FYI_DIR` | environment | `~/.fyi` | Where the store and its `config.json` live |

```json
{ "defaultScope": "work" }
```

`./install.sh fyi` asks for the default scope and writes the file; you
can also edit it by hand. The server reads it at start, so restart the
client after a change. A value that is not a scope stops the server
rather than letting items go to the wrong store.

## Developing

```bash
npm install
npm test          # suites drive a real server against a temporary store
npm run check     # validate the real store against the schemas
```

No build step: [tsx](https://tsx.is) runs the TypeScript directly. The
design, schemas, code layout and how to change the store's format are in
[SPEC.md](SPEC.md).
