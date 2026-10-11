# crew

Two things for running several Claude Code sessions at once:

- **Roles.** Start a session as a role, such as a coder or a reviewer,
  and it knows what it is for, what to read first, and how far to act
  on its own. Roles come from plugins, and you can write your own.
- **Coordination.** Sessions see who else is running and what each is
  doing, send each other messages, and hand work to whichever session
  can take it.

It needs [fyi](../fyi/README.md), where sessions save where they
stopped. The crew plugin is in progress: it works from a clone, and
replaces an earlier setup one step at a time.

## Installing

From a clone of jay:

```bash
./install.sh crew
```

This installs crew and fyi. Without a clone, in Claude Code:

```
/plugin marketplace add jsenko/jay
/plugin install crew@jay
```

The [main README](../../README.md) covers the permissions to add then,
updating and uninstalling.

## Roles

```
/crew:start coder fix the retry on startup
/crew:stop
```

`/crew:start <role> [purpose]` reads the role, joins the crew, loads
what the role lists, and reports in a few lines. With no role it starts
as `general` and names the others. `/crew:stop` saves where the session
stopped (the project's current state, and any decisions not yet
recorded), hands back work it holds, and leaves the crew.

A role is a Markdown file:

| Part | Says |
|---|---|
| Frontmatter | `name`, `description`, `capabilities` (the work it takes from the crew), `unattended` (whether it acts on that work with nobody watching), `fallback` (whether it takes work nothing else matches) |
| Purpose | What the session is for |
| Load at start, Load when needed | Which rules and processes it reads at once, and which only when they apply |
| Startup | What it checks before reporting |
| Work, Behaviour | How it works for the rest of the session |

[`roles/general.md`](roles/general.md) is a complete example. crew ships
only `general`; the code and pr plugins will bring coder, reviewer and
watcher.

Roles are found in two places, and yours win on a name clash:

| Where | Holds |
|---|---|
| `~/.jay/roles/` | Your own roles |
| `~/.jay/plugins/*/roles/` | Roles from installed plugins |

## Customising

Keep your own instructions outside the plugins, whose files are replaced
on every update:

| What | Where |
|---|---|
| Roles | `~/.jay/roles/<name>.md`. A role with a plugin's role's name replaces it |
| Rules and processes | `~/.jay/rules/`, `~/.jay/processes/`, named by full path from your roles, such as `~/.jay/rules/deploys.md` |
| Commands and skills | Your client's own folders: `~/.claude/commands/` and `~/.claude/skills/` for Claude Code |
| Rules for every session | `~/.claude/CLAUDE.md`, or `AGENTS.md` in opencode |

[`rules/authoring.md`](rules/authoring.md) is the guide for writing
these files: line budgets, references, and what earns a line. Sessions
follow it too, as when `/crew:stop` offers to write a role for work that
none describes.

## Coordination

| Tool | Purpose |
|---|---|
| `crew_join` | Register; the directory and repositories are detected |
| `crew_leave` | Deregister, handing back held work |
| `crew_who` | Who is running, where, doing what |
| `crew_state` | Set status (`idle`, `busy`, `focus`, `offline`) and activity |
| `crew_send` | A message to one session, or to all |
| `crew_post` | Post work, to one session or to whoever can take it |
| `crew_poll` | Collect what is waiting; `board: true` shows everything outstanding |
| `crew_claim` | Take the best-matching job |
| `crew_resolve` | Report the outcome: `done`, `failed` or `released` |
| `crew_extend` | Extend the lease on long-running work |

Work goes to a pool, not to a session: any session advertising the
capabilities a job needs can claim it, and the first claim wins. A
session the user is driving sets `focus`, and gets no work routed to it.
Capabilities are a fixed set (`review`, `code`, `watch`, `triage`, `ci`,
`docs`, `release`, `research`), so a typo fails at the call instead of
silently never matching.

```jsonc
// A watcher hands a review to whoever can take it
crew_post({ body: "Review PR 42", needs: ["review"], repo: "example/widgets" })
// → { job_id: "job-1", routable: true, eligible_sessions: ["review-widgets"] }

// A reviewer takes it, and reports back
crew_claim({})
crew_resolve({ job_id: "job-1", outcome: "done", detail: "2 must-fix" })
```

`routable: false` means no session can take the job now, so the poster
knows at once. A job still unclaimed when it expires (after 4 hours by
default), or handed back or abandoned three times, is
reported to the poster and flagged on the dashboard.

### Notifications

By default a session checks for work every 10 minutes. Claude Code can
instead wake it when something arrives, through its channels feature,
which a plugin cannot switch on by itself:

```bash
claude --dangerously-load-development-channels plugin:crew@jay
```

Claude Code asks you to confirm at each start. Several channels go in
one argument, as in `--dangerously-load-development-channels
plugin:crew@jay server:other`. Settings cannot replace the argument: the
allowlist that would is read only from managed settings, which need
root.

Claude Code does not tell crew whether it delivers the pushes, so a
session finds out by receiving one. Right after `crew_join`, crew pushes
`{"crew":"hello"}`. A session starts polling on a timer as usual, and
stops when the hello, or any other crew push, arrives. Without the
argument the hello is dropped, and the session keeps polling.

## Dashboard

```bash
~/.jay/plugins/crew/dashboard/run.sh start --open   # http://localhost:3457
~/.jay/plugins/crew/dashboard/run.sh stop
```

| View | Lists |
|---|---|
| Sessions | Who is running, with status, activity and what each takes; stale ones flagged |
| Jobs | Work not yet finished, with jobs that need someone first: stuck, expired, past their lease, or unroutable |

It is read-only, and shares its menu with the other installed plugins'
dashboards.

## Files

| Path | Holds |
|---|---|
| `~/.jay/crew/state.json` | Sessions, messages and jobs, guarded by `state.lock` |
| `~/.jay/roles/` | Your own roles |

The state is operational and rebuilt when missing or unreadable, so
deleting it loses only what is in flight.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `CREW_DIR` | `~/.jay/crew` | Where the state lives |

## Developing

```bash
npm install
npm test                    # drives real server processes, state in temp directories
npm start                   # the server on stdio, for manual inspection
dashboard/run.sh            # the dashboard in the foreground
```

The design and its reasoning are in [SPEC.md](SPEC.md).
