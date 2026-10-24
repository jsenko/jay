# Polling

Checking for work on a timer, for a session that pushes don't reach.

## Start

**Source:** `crew_join` reports `notifications: "poll"` and the session
advertises capabilities, or a role polls a source of its own, such as
the watcher's `get_new_events` → this session
**Processed by:** this session, until it stops polling

## One timer

Each wakeup costs a turn; the checks inside it are cheap. So a session
keeps one timer for everything it polls, named `poll` where the timer
takes a name:

1. Check every source the session polls: `crew_poll`, and the role's
   own, such as `get_new_events`. At start too: the first timer comes
   from these answers, never from an interval of the session's own.
2. Act on what they return.
3. Set the timer at the shortest `next_poll_minutes` among the answers.
4. When it fires, start again at 1.

A source checked before it asked to be only finds nothing, and its own
interval grows.

## The timer

Whatever the client gives the session to send itself a prompt later: a
wakeup or cron tool in Claude Code, `timer_set` in opencode with jay's
`timer` plugin. The prompt says what to check, such as "Polling: check
crew and GitHub events, per ~/.jay/plugins/crew/processes/polling.md".

No such tool: say so once, in the ready report, as
`Notifications: poll, but no timer: checks only when you write`. In
opencode, add that `./install.sh --opencode timer` provides one.

## Events

| Event | Action |
|---|---|
| A push arrives from a source, such as `{"crew":"hello"}` or `{"github":"hello"}` | Pushes reach this session from it: stop polling that source |
| No source is left to poll | Cancel the timer |
| The session takes capabilities with `crew_state` | Start polling crew, unless a crew push has arrived |
| It gives up its last capability | Stop polling crew |
