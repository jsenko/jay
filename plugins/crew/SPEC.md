# crew — design

crew has two parts. **Coordination** is an MCP server that lets
concurrent sessions discover each other, exchange messages, and route
work through a claimable queue (§1–§8). **Roles** are profiles a session
starts as, through `/crew:start` (§9).

Status: implemented.
Sections 1–8 were written before the server, and are kept for the
reasoning.

---

## 1. Architecture

**Transport: stdio, one server process per session.** The client
spawns it, so there is no daemon to manage, and
the process inherits the session's cwd. That is what lets `crew_join`
detect directory and repo without asking the model to shell out.

**State: one JSON file**, `~/.jay/crew/state.json`, guarded by
`~/.jay/crew/state.lock`, an exclusive-create lock file broken on age if
its holder was killed. Every mutation is a read-modify-write
under lock. At this scale — a handful of sessions, tens of messages —
contention is irrelevant.

JSON rather than markdown, deliberately. Crew state is operational, not
knowledge: heartbeats every few minutes, records deleted on leave. Under
the fyi store it would produce constant churn, and if that store is
kept in git, every heartbeat is a diff. It lives under `~/.jay`, not in
fyi's `~/.fyi`, because a plugin never writes another plugin's data.

**Retention:** messages carry a monotonic `seq`. A message is pruned once
it is older than one hour *and* below every live session's cursor, so a
session joining later still sees recent history.

### Notifications are a signal, never a payload

The server `fs.watch`es the state file and pushes
`notifications/claude/channel` when something lands for its session. The
notification carries **no content** — only "you have something". The
session then calls `crew_poll` to fetch it.

Some servers put the event in the notification; crew deliberately does
not. It makes `crew_poll` the
single delivery path, so delivery is cursor-mediated and idempotent, and
a session that both receives a push *and* polls cannot double-process.
The extra round trip is irrelevant at crew's volume; correctness under
dual delivery is not.

**Whether pushes arrive is learnt by receiving one.** `crew_join`
returns `notifications: "channel"` when the client declared the
experimental channel capability in the MCP handshake, and `"poll"`
otherwise. Claude Code (2.1.296) never declares it, even when it
delivers the channel, and neither the server nor the model can ask. So
the server pushes `{"crew":"hello"}` right after every join: a session
told `"poll"` starts its timer, and cancels it when any crew push
arrives. A dropped hello leaves the session polling, which is always
safe; using both is safe too — see above — just wasteful. Reading the
client's launch command instead was tried and rejected: it guesses from
option names, and can claim pushes that the allowlist then refuses.

Claude Code delivers a plugin server's pushes only when the session is
launched with `--dangerously-load-development-channels plugin:crew@jay`. The `channelsEnabled` and `allowedChannelPlugins`
settings would avoid the argument, but are read only from managed
settings, so polling is the default.

---

## 2. Data model

### Session

| Field | Notes |
|---|---|
| `id` | Server-generated, `^[a-z0-9-]+$`, ≤30 chars |
| `purpose` | One line, from the caller |
| `directory` | `process.cwd()` — the session's home directory |
| `directories` | Additional directories this session works in |
| `repos` | `Owner/Repo` list, derived from the above plus explicit additions: where it works, for affinity, not what it covers |
| `capabilities` | From the fixed enum below |
| `fallback` | If true, receives work nothing else matches — see §4 |
| `status` | `idle` \| `busy` \| `focus` \| `offline` |
| `activity` | 1–2 sentences, current work |
| `joined_at`, `last_seen` | ISO 8601 |
| `cursor` | Highest message `seq` consumed |

`focus` means the user is actively driving this session — the router
never assigns to it.

A session has one home `directory` but may work across several; repo
affinity (§4) matches against the whole `repos` set. Several sessions may
share a directory — ids stay distinct.

### Capabilities

A fixed enum, extended by editing it. Free strings were rejected because
`review` vs `reviews` would silently never match, and a routing failure
that looks like "nobody is available" is near-impossible to debug.

```
review      code        watch       triage
ci          docs        release     research
```

Unknown capability in `crew_join` or `crew_post` is an error naming the
valid set — a typo must fail loudly at the call, not silently at routing.

### Message

Directed, informational, no state machine. `seq`, `from`, `to`
(session id or `all`), `body`, `at`.

### Job

Work that someone must do. Directed when `to` is set, pooled otherwise.

| Field | Notes |
|---|---|
| `id`, `from`, `body` | |
| `to` | Session id, or unset for the pool |
| `needs` | Capabilities required |
| `repo`, `repo_required` | Affinity; preference by default, hard filter if required |
| `priority` | `critical` \| `high` \| `normal` \| `low` |
| `prefer`, `prefer_until` | Soft reservation — see §4 |
| `ref` | Opaque pointer, e.g. `pr:example/widgets#42` |
| `state` | `open` \| `claimed` \| `done` \| `failed` \| `stuck` \| `expired` |
| `claimed_by`, `lease_expires_at`, `attempts` | |
| `created_at`, `expires_at`, `expiry_min` | Default expiry 4h of claimable time |
| `ended_at` | When it reached a final state: `done`, `failed`, `stuck` or `expired` |

---

## 3. Tools

Ten tools. Tool definitions sit in context permanently, so the surface is
kept deliberately small — `done`/`failed`/`released` are one tool, not
three, and the full-board view is a flag rather than an eleventh tool.

| Tool | Input | Returns |
|---|---|---|
| `crew_join` | `{purpose, capabilities?, directories?, fallback?, id?, force_new?}` | `{session_id, notifications, others[]}` |
| `crew_leave` | `{}` | `{released_jobs[]}` |
| `crew_state` | `{status?, activity?, directories?}` | `{ok}` |
| `crew_who` | `{}` | `{sessions[]}` — id, purpose, repos, status, capabilities, last-seen |
| `crew_send` | `{to, body}` | `{seq, warning?}` |
| `crew_post` | `{body, to?, needs?, repo?, repo_required?, priority?, prefer?, expires_in?, ref?}` | `{job_id, routable, eligible_sessions[]}` |
| `crew_poll` | `{board?}` | `{next_poll_minutes}` when idle — see below |
| `crew_claim` | `{job_id?}` | The job, or `{claimed: null}` |
| `crew_resolve` | `{job_id, outcome, detail?}` | `{ok}` — outcome `done` \| `failed` \| `released` |
| `crew_extend` | `{job_id, minutes}` | `{lease_expires_at}` |

**`crew_join` is idempotent.** A live session in the same directory with
the same purpose is returned rather than duplicated; `force_new: true`
overrides when two really are wanted. Ids are generated server-side
(`<verb>-<context>`, collisions suffixed `-2`) and **reused across
restarts**: a directory+purpose pair that has been seen before gets its
previous id back, so older messages referencing it still make sense.
Nothing asks the user to confirm an id; `id` overrides when the caller
cares.

**`crew_post` reports routability synchronously.** `routable: false` with
an empty `eligible_sessions` means nothing can take this job *right now*
— the poster learns immediately instead of discovering it four hours
later. See §4.

**`crew_claim({})` with no argument is the normal path** — it picks the
best-matching open job and returns its content in one call, instead of
list-then-pick-then-claim.

**`crew_poll` returns only `next_poll_minutes` when there is nothing.** Populated:

```json
{
  "next_poll_minutes": 10,
  "messages": [{"seq": 42, "from": "watch-gh", "body": "...", "at": "..."}],
  "claimable": {"id": "job-9", "body": "...", "priority": "normal"},
  "jobs_mine": [{"id": "job-7", "lease_expires_at": "...", "slow": false}],
  "jobs_needing_attention": [{"id": "job-3", "state": "stuck", "attempts": 3, "body": "..."}]
}
```

`jobs_needing_attention` (stuck or expired) is reported to the job's
*poster*, not to claimers.

**`next_poll_minutes`** paces a session polling on a timer: 10 after
anything arrives (a message, a claimable job, one needing attention),
10 more after each poll that finds nothing, up to 60. The bounds are the
`polling` section of `~/.jay/config.json` (`min`, `step`, `max`). The
server can't tell whether pushes reach the session, so it always
answers; a session woken by pushes ignores it. github-events paces
`get_new_events` the same way, from the same shared code.

**`crew_poll({board: true})`** additionally returns every open, stuck and
orphaned job regardless of whether this session matches — the deliberate
"what is outstanding anywhere?" view. Kept behind a flag so the routine
poll stays cheap and targeted.

---

## 4. Routing and claim semantics

A job is **eligible** for a session when all hold:

- `state == open`
- `to` unset, or `to == me`
- my `capabilities` ⊇ job `needs`
- `repo_required` false, or job `repo` ∈ my `repos`
- my status is `idle` or `busy` — never `focus` or stale
- `prefer` unset, or `prefer == me`, or `now > prefer_until`

Ordering among eligible jobs: **priority desc → repo match → oldest
first.**

**A pooled job is offered to every eligible session at once, and the
first `crew_claim` wins.** Claims are atomic under the state lock; losers
get `{claimed: null, reason: "taken"}`, which is a result, not an error.
There is no fan-out — a job is done by exactly one session.

**Soft reservation.** `prefer` names a session that gets an exclusive
window (`prefer_until`, default 10 minutes) before the job opens to
everyone. This is how re-review stickiness works — the session that
reviewed a PR holds context, so give it first refusal, but never block
the job on a session that may be gone.

**Leases.** Default 60 minutes, max 4 hours, extendable via
`crew_extend`. Reviews are slow, so the default is generous.

**Reclaim requires two conditions**, not one: the lease must be expired
*and* the holder must be stale. A live-but-slow session keeps its job and
is flagged `slow: true` to the poster instead of having work stolen from
under it. A dead session's jobs are released as soon as it goes stale,
without waiting out the lease.

**Poison-job guard.** Each reclaim increments `attempts`. At
`attempts >= 3` the job becomes `stuck` and is never auto-routed again —
it surfaces to the poster and on the dashboard. Without this, a job that
reliably kills its claimer cycles forever, burning tokens on every retry.

### Jobs nobody can take

Distinct from `stuck` (claimed and failed repeatedly): **unroutable**
means no live session matches at all. Three mechanisms, escalating:

1. **Synchronous** — `crew_post` returns `routable: false`. The poster
   knows at once and can tell the user rather than assuming delivery.
   The job then **waits**: expiry counts only time when some session
   could have claimed it, so a queue held up by a reviewer in `focus`
   is intact when focus ends. A job waits at most three days from
   posting, so work for a session that never comes still reaches its
   poster. Re-posting a waiting job only duplicates it.
2. **Re-evaluation** — when any session joins, changes status, or changes
   capabilities, the server re-checks open jobs and notifies sessions
   that have become eligible. A job unroutable at post time routes itself
   the moment a matching session appears.
3. **Fallback tier** — a session with `fallback: true` is offered jobs
   that match nothing else, *ignoring the capability check* (repo and
   status still apply). This is the designated "I'll look at whatever is
   left" session the user knows to check.

On expiry unclaimed, a job **messages the poster**, so an automated
poster (the watcher) learns its delegation failed and can stop assuming
it succeeded. The message carries the job's body and waits until read.

Silently dropping an expired job is never correct: either the work
mattered, in which case it belongs on a list, or it did not, in which
case it should not have been posted. Putting it on a list is the
poster's move, with fyi's tools: a plugin never writes another plugin's
data, so crew cannot promote the job itself.

**Every ended job is pruned** an hour after `ended_at`, whatever its
final state. The board keeps it that long, so the poster can still see
it there; the message is what lasts.

---

## 5. Error handling

| Case | Behavior |
|---|---|
| `crew_join` when already joined | Return the existing session. Not an error. |
| `crew_claim` with nothing eligible | `{claimed: null}`. Not an error. |
| `crew_claim` on an already-claimed job | `{claimed: null, reason: "taken"}` |
| `crew_resolve` on a job not held by caller | Error, names the actual holder |
| Unknown capability | Error, lists the valid enum |
| `crew_send`/`crew_post` to unknown session | Error, lists known session ids |
| `crew_send` to offline or stale session | Succeeds, returns a warning with last-seen. The message waits. |
| State file missing or corrupt | Rebuild empty, log once. Crew state is reconstructible; never block a session on it. |
| State file in an older format (`version` below `STATE_VERSION`) | Rebuild empty, log once, as for a corrupt one: the state is short-lived, so it is not migrated. |
| State file in a newer format | Refuse every call, saying to update crew. A newer crew wrote it, and overwriting it would destroy that crew's state. Raise `STATE_VERSION` with any incompatible change to the state's shape. |

The distinction throughout: "nothing to do" is a result, not an error.
Errors are reserved for genuine caller mistakes, so the model never has
to pattern-match an error string to decide whether it is idle.

### Detecting that a session is gone

Two tiers:

1. **Immediate** — the stdio server sees `process.stdin` end when the
   client disconnects and
   marks its own session `offline`, releasing claims. This covers clean
   exits and closed terminals, which is nearly all of them.
2. **Backstop** — `last_seen` older than 45 minutes is stale. Covers
   `SIGKILL` and machine loss, where nothing got a chance to run.
   Every tool call refreshes `last_seen`, and so does a heartbeat every
   five minutes while the server runs: a session woken by pushes makes
   no calls while it waits, and without the heartbeat it went stale and
   was never offered work.

---

## 6. Relationship to the fyi store

**Sessions and jobs are not fyi items.** Crew records are ephemeral
operational state with a high write rate and locking needs; fyi items
are durable knowledge, possibly kept in git. Forcing them together would
churn the store with every heartbeat.

The boundary is crossed in two places, both explicit and both by a
session, never by the server:

> **Expiry** — the poster of an unclaimed job that expires is told, and
> captures it as an fyi task if it still matters. Work that needed doing
> *now* and didn't get done is work that needs doing *later* (§4).

> **Handoff pointers** — `crew_send` carries a *reference* to fyi
> content, never the content itself. See §7.

Each plugin's dashboard reads only its own store. They share a menu,
so crew's and fyi's views sit side by side without either reading the
other's data.

---

## 7. Handoff: continuing work elsewhere

The problem: `/resume` is directory-scoped and reloads everything. What's
wanted is to continue *work* — possibly in a different directory, in a
different session — with less context but the right context.

**Sessions stay ephemeral, and handoff is not session resumption.** A
session is a process with a conversation; when it exits, both are gone,
and a session bound to a directory cannot meaningfully reappear
elsewhere. What can move is the *work*, and work is already
directory-independent: an fyi project has N:M `work-directories`.

So the handoff is assembled from fyi, not stored in crew:

| Question on resuming | Answered by |
|---|---|
| What is this work? | project `description` |
| What is the plan? | the project's tracking files |
| What was decided, and why? | decision notes on the project |
| What happens next? | open tasks linked to the project |
| **Where did the last session stop?** | **`current_state` on the project — new** |

`current_state` is a short mutable field — overwritten, never appended,
always current. It is not a log; the history is in git and in the notes.

`fyi_handoff({project})` assembles those five into ~30 lines. That is the
"less but more important context" version of `/resume`, and it works from
any directory because none of its inputs are directory-bound.

Crew's only role is to carry the pointer: session A sends
`crew_send({to: B, body: "picking this up? handoff: project-gitops"})`
and B calls `fyi_handoff`. Content lives in fyi, routing lives in crew,
neither reimplements the other.

Ad-hoc work with no project has no handoff. That is a deliberate forcing
function — if work is worth resuming later, it is worth one
`fyi_capture({type: "project"})` now. It is only a fair trade if creating
a project is nearly free — a project needs only a title and a
description.

---

## 8. Open items for implementation

- **`current_state` staleness.** Nothing forces a session to update it
  before exiting. fyi stamps it with `current_state_at` and the handoff
  shows its age, which makes stale state visible rather than preventing
  it.
- **Fallback session flapping.** If two sessions both set
  `fallback: true`, unmatched jobs race between them. Probably fine;
  confirm it is not surprising in practice.
- **Re-evaluation cost.** Re-checking all open jobs on every status
  change is trivial at current scale but is O(jobs × sessions) per event.
  Revisit if either grows.

---

## 9. Roles

A role is a Markdown profile: frontmatter for what the crew needs
(`capabilities`, `unattended`, `fallback`), and sections for what the
session loads and how it behaves. `/crew:start` reads it, joins with
its frontmatter, and loads only its **Load at start** files.

**Where roles live.** Each role ships in the plugin that owns its
workflow (coder in code, reviewer and watcher in pr), found through
`~/.jay/plugins/*/roles/`. The user's own roles live in `~/.jay/roles/`
and win on a name clash. Outside the plugins, because a plugin's files
are replaced on every update; winning, so a user can adjust a shipped
role without forking the plugin.

**Switching roles needs a new session.** Capabilities can change in
place (`crew_state`), but loaded context cannot be unloaded, so a role
switched in place would be the union of both.

**`always.md`** holds the few habits every session needs whatever its
role: checking the date, bringing the user only what they can act on,
and recording friction. Habits for one workflow belong in that
workflow's rules; personal habits belong in the client's own
always-loaded file (`~/.claude/CLAUDE.md`, `AGENTS.md`).

## 10. Authoring rules

`rules/authoring.md` ships in crew rather than in the repository's
docs, because a marketplace install copies only the plugin's folder, and
sessions writing a user's role need to read it.

Its budgets are deliberately tight. Instruction files once grew to 415
lines while conciseness was only asked for, so the numbers make the
limit checkable rather than aspirational; `tools/check` enforces them in
this repository.

`~/.jay/plugins/<name>` is a link to the plugin's installed root, made
by each plugin's `SessionStart` hook. Plugins install under versioned
cache directories, so the link is the only path that stays the same
across versions, and the only one instruction files use.
