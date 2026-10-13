# plugin

Pieces every plugin shares. Each plugin links to them with a relative
symlink, so there is one copy to edit. A plugin can only rely on files
inside its own folder, and that still holds: Claude Code follows the
links when it copies a plugin into its cache, so an installed plugin
holds the files themselves. `tools/check` fails when a link is missing
or points elsewhere.

| Here | Linked from | Applies to |
|---|---|---|
| `hooks/` | `plugins/<name>/hooks` | every plugin |
| `opencode/` | `plugins/<name>/opencode` | every plugin, with `opencode.mjs` beside it |
| `dashboard/shell/` | `plugins/<name>/dashboard/shell` | plugins with `dashboard/dashboard.json` |
| `dashboard/run.sh` | `plugins/<name>/dashboard/run.sh` | the same |

For a new plugin, from its folder:

```bash
ln -s ../../tools/plugin/hooks hooks
ln -s ../../tools/plugin/opencode opencode
ln -s ../../../tools/plugin/dashboard/shell dashboard/shell      # with a dashboard
ln -s ../../../tools/plugin/dashboard/run.sh dashboard/run.sh
```

## hooks

A `SessionStart` hook that links `~/.jay/plugins/<name>` to the plugin's
installed root. Instruction files reference each other through that
link, since the installed root changes with every version.

## opencode

The adapter that loads a plugin into opencode. Each plugin's
`opencode.mjs` calls `jayPlugin` with its own folder; `install.sh
--opencode` points opencode at that file. Through opencode's `config`
hook, the adapter adds the plugin's commands, MCP servers and skills,
allows the directories its sessions use, and links `~/.jay/plugins/<name>`,
which in Claude Code the `SessionStart` hook does.

opencode namespaces neither commands nor skills, so there they are named
`<plugin>-<name>`: `/crew-start`, and code's `style` skill is
`code-style`. A skill is registered as a renamed copy under
`~/.local/share/jay/<plugin>/opencode-skills/`, since opencode reads the
name from the file. MCP servers keep their names, so opencode's tool names
are the same as before.

`node --test 'tools/plugin/opencode/test/*.test.mjs'` runs the adapter
over every plugin in this repository.

## dashboard

The frame every dashboard runs on: the server, the page, the shared menu,
and `run.sh`. A plugin adds four things to its `dashboard/`:

| File | Holds |
|---|---|
| `dashboard.json` | `title`, a fixed `port`, and `views`: the menu entries, each `{ id, label, icon }` |
| `server.ts` | Calls `serve()` from `shell/server.ts` with the dashboard's `state`, `badges` and `actions` |
| `public/views.js` | The page's rendering: `rows`, `find`, `renderDetail`, and optionally `actions` and `footer`, as listed at the top of `shell/public/shell.js` |
| `../package.json` | At the plugin root: `"type": "module"`, and `tsx` among the dependencies |

Ports so far: fyi 3456, crew 3457.

Every dashboard lists the views of all installed dashboards, found through
`~/.jay/plugins/*/dashboard/dashboard.json`. Choosing another plugin's
view opens that dashboard, after starting it if it is not running.

The server listens on 127.0.0.1 only. It refuses requests whose `Host`
is not this machine, and changes sent as anything other than JSON, so a
page on another site cannot read or change anything through it.

`dashboard/run.sh` runs a dashboard in the terminal. `run.sh start`
starts it in the background and prints its URL, and `run.sh stop` stops it
by asking the server to exit (`POST /shutdown`), however it was started.
`--open` opens a browser too. The menu starts other dashboards with
`run.sh start`.
