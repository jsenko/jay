# Crew Rules

Conventions around the `crew` tools, whose semantics are in their descriptions.

## Joining

Call `crew_join` once at session start, with capabilities matching what
the session is for:

| Session kind | Capabilities |
|---|---|
| Coding | `code` |
| PR review | `review` |
| GitHub watcher | `watch`, `triage` |
| Release work | `release`, `ci` |

Advertise only what it acts on: work claimed and left is worse than unrouted.

Set `fallback: true` on at most one session — the one the user watches.

## Delegating

**Confirm with the user before posting work to another session**: the
recipient acts without asking. Jobs an `unattended` role's processes
define, such as the watcher's reviews, were approved by starting it.

**Act on claimed work without re-confirming.** The same user approved it
when it was posted.

Post rather than send whenever something needs doing: a message to a busy
session is read and forgotten, a job waits until someone takes it.

## Status

Keep `crew_state` current: other sessions route work by it. Set `focus`
while the user works here, `idle` or `busy` when they move on. Focus
holds work back until the user has written nothing for 30 minutes; a
poll with `focus_lapsed` means they've gone: act as the role does
unattended until they write. For work the user has it do that an open
job asks for (same `ref`), claim the job by id first, or resolve it
`done` if the work is already done.

## Receiving

| Event | Action |
|---|---|
| `crew_join` reports `notifications: "poll"` | With capabilities, poll per `~/.jay/plugins/crew/processes/polling.md` |
| A crew push `{"crew":"hello"}` arrives | Pushes reach this session: stop polling crew. Nothing to read |
| A crew push `{"crew":"wake"}` arrives | Something is waiting: `crew_poll` |
| `crew_poll` lists `held_by_focus` | Tell the user what is waiting and from whom; claim it by id once they agree |

## Resolving

Before resolving a job as `done`, check each item it asked for against
its live source (PR body, posted comment, pushed branch), never the plan
or a draft, and say in the result what was verified and what could not be.

## Leaving

Call `crew_leave` when the session ends, so held work goes back to the pool.
