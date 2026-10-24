# Crew Rules

Conventions around the `crew` tools; their semantics are in the tool
descriptions.

## Joining

Call `crew_join` once at session start, with capabilities matching what
the session is for:

| Session kind | Capabilities |
|---|---|
| Coding | `code` |
| PR review | `review` |
| GitHub watcher | `watch`, `triage` |
| Release work | `release`, `ci` |

Advertise only what the session will actually act on. A capability it
ignores makes work sit claimed and unstarted, which is worse than the
work not being routed at all.

Set `fallback: true` on at most one session — the one the user watches.

## Delegating

**Confirm with the user before posting work to another session.** The
recipient acts on it without asking, so the sending side is where the
decision belongs — except the jobs an `unattended` role's processes
define, such as the watcher's reviews: starting the role approved them.

**Act on claimed work without re-confirming.** The same user approved it
when it was posted.

Post rather than send whenever something needs doing: a message to a busy
session is read and forgotten, a job waits until someone takes it.

## Status

Keep `crew_state` current — other sessions route work by it.

Set `focus` whenever the user is actively working in this session, and
back to `idle` or `busy` when they move on. Focus removes the session
from routing, so leaving it set strands work.

## Receiving

| Event | Action |
|---|---|
| `crew_join` reports `notifications: "poll"` | With capabilities, poll per `~/.jay/plugins/crew/processes/polling.md` |
| A crew push `{"crew":"hello"}` arrives | Pushes reach this session: stop polling crew. Nothing to read |
| A crew push `{"crew":"wake"}` arrives | Something is waiting: `crew_poll` |

No capabilities, no polling: nothing is routed there.

## Leaving

Call `crew_leave` when the session ends, so held work returns to the pool
instead of waiting out its lease.
