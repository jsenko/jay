# fyi — tool surface spec

Durable store for tasks, notes, projects and tracked pull requests.
Markdown stays the source of truth; this server is a faster, safer way
in.

It replaced, in the setup jay grew out of, a 415-line command and a
166-line format rule that had a model edit Markdown by hand, two shell
scripts, and hand-maintained YAML indexes.

Status: implemented. Written before the server, and kept for the
reasoning; the code layout, development notes and status are at the end.
User documentation is in [README.md](README.md).

---

## 1. Storage

**One file per item**, `~/.fyi/<scope>/<type>/<id>.md`, where `<scope>`
is `default`, `work` or `personal`. `config.json` in the store's root
names the scope calls use when they name none, `default` if unset; it
lives with the store so `FYI_DIR` moves both.

Called a scope, not a repository: a `pr` item carries its own `repo`
field meaning `Owner/Repo`, and the two collided when both were named
`repo`.

```
~/.fyi/default/
  task/task-fix-the-retry.md
  note/note-varnish-over-custom-cache.md
  project/project-storage.md
  pr/pr-widgets-8676.md
```

One file per item rather than the current multi-object `TASKS.md`:
writes are atomic, invalidation is per-item, and it leaves git-tracking
`~/.fyi` as a later yes/no rather than a rewrite. Multi-object files
would make merge conflicts inside a single file a routine event.

**Project folders** (`<scope>/projects/<name>/`) hold a project's files
that are not items: plans, design notes, phase files. fyi owns the
location and hands it out as `folder` (`folders.ts`), so no other plugin
reads the store's layout, and a later change to that layout moves the
folders with everything else. The path is derived from the project id,
never stored, so it cannot go stale; the naming matches the folders
sessions were already keeping there by hand.

**Format:** YAML frontmatter for schema fields, markdown body for the one
long prose field per type (`description`, `content`, `summary`). The body
is the part a human edits; the frontmatter is the part tools query.

**Active and archived items live apart.** `<scope>/<type>/` holds the
active set; `<scope>/archive/<type>/` holds what has been archived. The
active set is scanned on every call, the archive only when a query asks
for it — which is what keeps the index in memory without a database as
the store accumulates years of finished work.

The old inbox/grouped/archive regions were a manual filing system that
existed because search did not. This split is not a filing decision: the
server makes it, and nothing is ever deleted.

## 2. Schemas

Item types are JSON Schema files in `schemas/`, loaded at startup:
`common.json` merged into each of `task`, `note`, `project`, `pr`.

Adding a field means editing a schema file and restarting. There is no
runtime type creation — schema-as-data is not dynamism.

**MCP tool input schemas are generated from these files.** The model
learns the fields from tool definitions it already receives, so no
document has to describe the format. That is what takes
`pr-tracking-format.md` to zero loaded tokens, and what stops the format
having three implementations that can disagree.

Deliberately constrained subset: string, number, boolean, enum, date,
`x-fyi-ref`, and arrays of those. A type needing `oneOf`/`allOf` is a
sign the model is wrong.

## 3. Index

Held in memory, built at startup, invalidated per file by mtime. No
database: the store is ~1.9MB across ~180 items, which parses in tens of
milliseconds.

**Writes go through immediately.** Never cache-and-flush — deferred
writes break hand-editability, which is the whole reason for choosing
markdown, and open a window where the file and the server disagree.

A real query engine (markbase) earns its place when a full scan exceeds
~100ms, full-text search is wanted, or this goes multi-machine. The tool
surface below is designed so that swap changes no caller: nothing leaks
a file path or a storage region.

## 4. Tools

| Tool | Purpose |
|---|---|
| `fyi_capture` | Create an item. Fields validated against its schema. |
| `fyi_update` | Change fields on an existing item. |
| `fyi_get` | Read one item in full. |
| `fyi_search` | Find items by type, text, and `where` conditions on any field. |
| `fyi_today` | Tasks due or overdue, PRs needing attention, active projects — one call. |
| `fyi_link` | Relate two items. |
| `fyi_handoff` | Assemble resume context for a project. |
| `fyi_convert` | Change an item's type, carrying context and provenance. |

`fyi_search` keeps to filters a query engine can serve — equality,
membership, substring, ranges, presence — rather than growing ad-hoc
grep options that would not survive the markbase swap. They are one
generic `where` over dotted field paths rather than an input per field,
and its tool definition is generated from the schemas like capture's.

## 4b. Mirrored items

Two kinds of item, failing differently:

| Kind | Source of truth | Can go stale? |
|---|---|---|
| Authored — task, note, project | The store | No. Old is not wrong |
| Mirrored — pr | An external system | Yes, silently |

A mirrored type declares `x-fyi-freshness` in its schema beside the
archive policy, and carries `synced_at` — when it was last
*confirmed*, as distinct from last *changed*. A record can be freshly
written and badly stale.

**Staleness is reported on read**, by `fyi_get`, `fyi_search` and
`fyi_today` alike. A consumer that has to remember to ask will not.
Never confirmed counts as stale.

**The server never refreshes.** It knows nothing about GitHub, and
keeping it that way means a new mirrored type costs a schema entry
rather than code here. It reports; the session that knows how to fetch
truth calls `fyi_update` with `synced: true`. Only that explicit claim
stamps `synced_at`, so a local edit cannot make a stale record look
confirmed.

That is also what lets a review happen while the watcher is down:
refresh the one PR, no full sync.

## 5. Rules the server enforces

**Every task has a next action date.** `next_action_at` is required. A
task with no next action is a note, and the server says so rather than
accepting an item that will rot silently.

**Nothing is deleted.** Archiving moves a file to the archive directory
and removes it from the active set. It stays readable, and searchable
with `include_archived`.

**Items archive themselves.** Each type declares a policy beside the
fields it reads (`x-fyi-archive`) — a task 14 days after it is done or
cancelled, a PR 7 days after it merges or closes, a project 30 days
after it is done or abandoned. A note follows its project: archived when
the project is. A note with no project is archived by hand, or expires
when given `archive_after_days`.

**Finishing is recorded once.** Types with a finished state get
`completed_at`, stamped when an item enters that state and cleared if it
is reopened. Archiving counts from it rather than from `updated_at`,
which every later edit moves, and "what was finished this week" is a
search on it. Items finished before it existed were backfilled from
their last edit (`migrations/completed-at.ts`).

Per item, `archive_after_days` overrides the window and `pinned` opts out
entirely. On a note, which has no finished state, `archive_after_days`
counts from the last change, so setting it means "that many days from
now", and a note still being edited stays. There is no reconciliation pass, because a periodic cleanup is
exactly the chore that does not get run. On-demand tidying stays possible
but should be rare.

**Scope defaults to `default`**, or to `defaultScope` in the store's
`config.json`, read once at start. `fyi_search` and `fyi_today` look in the default
unless asked otherwise; `scope: "personal"` or `"all"` widens. A session
is never locked to one store — a work task that turns up a personal
errand can capture it directly — but crossing over is opt-in per call
rather than the default.

**Provenance is written, not optional.** `fyi_convert` always records
where an item came from, so "why does this task exist?" is answerable —
which matters most for items an automated poster created unattended.

## 6. What was removed, and why

| Type | Disposition |
|---|---|
| `event` | **Deleted.** All 276 stored events were GitHub-derived and re-derivable from `gh`. An event that is not immediately a task, a note or a field update is not worth a record. |
| `rule` | **Deleted.** Rules are agent source code: versioned, reviewed, installed. They belong in the repo next to the commands that use them, not in a personal inbox. |
| `resource` | **Folded into `note`** as `paths` and `urls`. Two entries existed in practice; it was a note with attachments. |

Also removed: the three storage regions, the tag design criteria, the
hand-maintained YAML indexes, and the reconciliation procedure. Search
replaces indexes; validation on write replaces reconciliation.

## 7. Relationship to crew

Crew holds ephemeral operational state, fyi holds durable knowledge. The
boundary is crossed in two places:

> **Expiry promotion** — a crew job that expires unclaimed becomes a
> task. Work that needed doing now and did not get done is work that
> needs doing later.

> **Handoff** — `crew_send` carries a reference to fyi content, never the
> content itself.

## 8. Open items

- **Human-readable listing.** One file per item loses `cat TASKS.md`.
  A server-generated `INDEX.md` per type would restore it — derived and
  disposable, so it does not reintroduce hand-maintained indexes.
- **Scopes as directories.** The scopes are a fixed list. Making them
  the directories that exist, with a tool to create one, needs the
  non-scope entries in `~/.fyi` (`crew/`, `reports/`) out of the way
  first, for example under `~/.fyi/scopes/`.
- **`current_state` staleness.** `current_state_at` records the age, but
  nothing forces an update before a session exits.

## 9. Schema keywords

Use only the supported subset of JSON Schema: string, number, integer,
boolean, enum, `format: date` / `date-time`, arrays, and objects with
declared properties. Beyond it, fyi reads its own keywords:

| Keyword | On | Meaning |
|---|---|---|
| `x-fyi-archive` | a type | When items move to the archive: a field, its terminal values and a delay — or `follows`, a reference field whose target's archiving this item follows |
| `x-fyi-freshness` | a type | The type mirrors an external system: its name, and how many hours a sync stays fresh |
| `x-fyi-key` | a type | The field identifying what a mirrored item stands for. Names the item and refuses duplicates |
| `x-fyi-ref` | a field | The field holds another item's id — of the named type, or `any`. Checked on write |

## 10. Code layout

Under `server/`:

| File | Purpose |
|---|---|
| `server.ts` | MCP wiring: transport, dispatch, lifecycle |
| `tools/` | One file per tool, each owning its schema and handler |
| `schemas/` | The item types, as JSON Schema |
| `schema.ts` | Schema loading, validation, tool-input generation |
| `store.ts` | Markdown on disk, index in memory, write-through |
| `frontmatter.ts` | Frontmatter and body serialisation |
| `query.ts` | Search over the index |
| `where.ts` | Field conditions for search, and their tool input |
| `identity.ts` | Item ids: keyed for mirrored types, slugs for authored ones |
| `keys.ts` | Natural keys: URL parsing, derived fields, duplicate lookup |
| `refs.ts` | Reference checks, and repointing references on a rename |
| `fieldpath.ts` | Dotted paths through lists, shared by search and references |
| `listops.ts` | Adding and removing list entries without rewriting the list |
| `archiving.ts` | When items leave the active set, from `x-fyi-archive` |
| `completion.ts` | `completed_at`: stamped on finishing, cleared on reopening |
| `folders.ts` | Project folders: where a project's files go |
| `config.ts` | Settings from the store's `config.json` |
| `check.ts` | The store checker, `npm run check` |
| `migrations/` | One-off store migrations, each runnable with `--dry-run` |
| `test/` | Suites driving a real server over stdio against a temporary store |

The dashboard, under `dashboard/`, reads the server's modules directly
rather than going through MCP: MCP is a façade for models, and a second
parser of the Markdown would drift from the first. Writes go through the
same store, so validation and archiving apply.

| File | Purpose |
|---|---|
| `dashboard.json` | Title, port 3456, and the views in the menu |
| `server.ts` | Hands the data, counts and actions to the shared shell |
| `data.ts` | Assembles the snapshot the page renders |
| `badges.ts` | The menu counts, also read by other plugins' dashboards |
| `attention.ts` | Whose move an attention item is, when it does not say |
| `actions.ts` | Done and snooze, the only changes the page makes |
| `public/views.js` | What the shell's page shows: rows, details, actions |
| `public/rows.js`, `details.js`, `format.js` | The list rows, the details panel, PR chips |
| `shell/`, `run.sh` | The shared dashboard shell, symlinked from `tools/plugin/dashboard/` |
| `paths.ts`, `types.ts`, `validation.ts`, `errors.ts`, `time.ts` | Small shared pieces |

## 11. Changing the format

Files outlive the schema they were written under. After changing a
schema, run `npm run check` against the real store; whatever it reports
needs a migration in `server/migrations/`, one file per change, run with
`--dry-run` first, in the same change as the schema.

The tests cover the schema-generated tool definitions, validation,
capture, both naming conventions and the rename migration, search
conditions, reference checks, list operations, archiving, settings, the
store checker, the assembled views (today, handoff, convert, link), and
the hand-edit round trip the Markdown-as-source-of-truth design depends
on.

## 12. Status

| Stage | State |
|---|---|
| Schemas, storage, capture/search/get/update | Done |
| `fyi_today`, `fyi_link`, `fyi_handoff`, `fyi_convert` | Done |
| Migration of existing tasks, notes, projects, PR files | Done |
| A dashboard over the store | Done |
| Packaged as a jay plugin, with a configurable default scope | Done |
| Scopes as directories, with a tool to create one | Planned |

