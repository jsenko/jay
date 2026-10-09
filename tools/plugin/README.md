# plugin

Pieces every plugin carries a copy of. A plugin can only rely on files
inside its own folder, because a marketplace install copies nothing
else, so shared code is copied rather than referenced.

This directory mirrors a plugin's layout. Each file here is copied to the
same path in every plugin it applies to, and `tools/check` fails when a
copy differs:

| Here | Copied to | Applies to |
|---|---|---|
| `hooks/` | `plugins/<name>/hooks/` | every plugin |
| `dashboard/` | `plugins/<name>/dashboard/` | plugins with `dashboard/dashboard.json` |

Edit the files here, then copy them into the plugins.

## hooks

A `SessionStart` hook that links `~/.jay/plugins/<name>` to the plugin's
installed root. Instruction files reference each other through that
link, since the installed root changes with every version.

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
