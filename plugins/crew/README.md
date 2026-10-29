# crew

Two things for running several Claude Code sessions at once:

- **Roles.** Start a session as a role, such as a coder or a reviewer,
  and it knows what it is for, what to read first, and how far to act
  on its own. Roles come from plugins, and you can write your own.
- **Coordination.** Sessions see who else is running and what each is
  doing, send each other messages, and hand work to whichever session
  can take it.

It needs [fyi](../fyi/README.md), where sessions save where they
stopped.

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

In opencode, `./install.sh --opencode crew` installs it from the clone;
its commands are `/crew-start`, `/crew-stop` and `/crew-retry-smaller`
there, and sessions poll instead of receiving pushes.

## Roles

```
/crew:start coder fix the retry on startup
/crew:stop
```

`/crew:start <role> [purpose]` reads the role, joins the crew, loads
what the role lists, and reports in a few lines. With no role it starts
as `general` and names the others. `/crew:stop` saves where the session
stopped (the project's current state, any decisions not yet recorded,
and, if you say yes, a session note), hands back work it holds, and
leaves the crew.

**End a session started with `/crew:start` with `/crew:stop`.** The
session note is what lets a later `/crew:start` offer to continue: it
lists up to three earlier sessions matching its role and its directory,
repository or purpose, and picks one up if you say so. Notes expire
after 7 days. A session that just exits still leaves the crew and hands
back its work, but saves nothing; `claude --resume` reopens its
conversation instead.

A role is a Markdown file:

| Part | Says |
|---|---|
| Frontmatter | `name`, `description`, `capabilities` (the work it takes from the crew), `unattended` (whether it acts on that work with nobody watching), `fallback` (whether it takes work nothing else matches) |
| Purpose | What the session is for |
| Load at start, Load when needed | Which rules and processes it reads at once, and which only when they apply |
| Startup | What it checks before reporting |
| Work, Behaviour | How it works for the rest of the session |

[`roles/general.md`](roles/general.md) is a complete example. crew ships
only `general`; the [code](../code/README.md) plugin brings `coder`, and
the [pr](../pr/README.md) plugin brings `reviewer` and `watcher`.

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
| `crew_join` | Register; the directory and repositories are detected, and stranded work is warned about |
| `crew_leave` | Deregister, handing back held work |
| `crew_who` | Who is running, where, doing what |
| `crew_state` | Set status (`idle`, `busy`, `focus`, `offline`) and activity |
| `crew_send` | A message to one session, or to all |
| `crew_post` | Post work, to one session or to whoever can take it |
| `crew_poll` | Collect what is waiting; `board: true` shows everything outstanding |
| `crew_claim` | Take the best-matching job, or one by id |
| `crew_resolve` | Report the outcome: `done`, `failed` or `released`. Also closes an open job: its poster withdrawing it, or work done outside it |
| `crew_extend` | Extend the lease on long-running work |

Work goes to a pool, not to a session: any session advertising the
capabilities a job needs can claim it, and the first claim wins. A
session the user is driving sets `focus`, and gets no work routed to it,
though it can still claim a job by id when the user has it do that work.
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
knows at once. The job then waits for one, for example while the only
reviewer is in `focus`, rather than expiring: expiry (4 hours by
default) counts only time when some session could have claimed it, and
a job waits at most three days. A job that expires, or is handed back or
abandoned three times, is reported to the poster and flagged on the
dashboard, then cleared an hour later.

### Notifications

By default a session checks for work on a timer: ten minutes after
anything happens, ten more after each check that finds nothing, up to an
hour. Launched with the channels flag, Claude Code instead wakes it when
something arrives, which is the recommended setup: see
[Efficiency](../../README.md#efficiency).

A session that polls more than crew, such as the pr watcher, which also
polls GitHub events, keeps one timer for both and wakes at the shorter
of the two waits: each wakeup costs a turn, and the checks in it are
cheap. opencode has no timer for the model of its own; jay's
[timer](../timer/README.md) plugin gives it one, and a session without
a timer says so when it starts.

Claude Code does not tell crew whether it delivers the pushes, so a
session finds out by receiving one. Right after `crew_join`, crew pushes
`{"crew":"hello"}`. A session starts polling on a timer as usual, and
stops when the hello, or any other crew push, arrives. Without the
argument the hello is dropped, and the session keeps polling.

## When a response is too large

```
/crew:retry-smaller
```

When a response is refused for being too large (in opencode, "the
response was blocked by the provider's content filter"), the session
can't tell: from its side nothing went wrong. Run `/crew:retry-smaller`
and it finds what was too big, then does the same work in smaller
pieces. If that keeps failing, it saves where it stopped so a fresh
session can pick up with `fyi_handoff`.

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

In `~/.jay/config.json`:

| Setting | Default | Purpose |
|---|---|---|
| `sessions.keep_days` | `7` | How long a session note is offered for pickup |
| `polling.min`, `.step`, `.max` | `10`, `10`, `60` | Minutes between checks without channels ([Efficiency](../../README.md#efficiency)) |

## Developing

```bash
npm install
npm test                    # drives real server processes, state in temp directories
npm start                   # the server on stdio, for manual inspection
dashboard/run.sh            # the dashboard in the foreground
```

The design and its reasoning are in [SPEC.md](SPEC.md).
