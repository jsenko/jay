# timer: design

Why the timer plugin works the way it does. What it does is in the
[README](README.md).

## 1. Why a plugin

crew and the pr watcher poll "on a timer" when pushes don't reach a
session. Claude Code gives the model wakeup and cron tools for that.
opencode gives it none: a headless `/crew-start coder` joined, polled
once, and reported that it couldn't schedule the next poll, so in
opencode polling happened only when the user sent a message.

opencode's plugin API can do it. A plugin's tool call knows its session,
and the SDK client's `session.promptAsync` sends a message into a
session at any time. That is the whole mechanism.

It is a plugin of its own rather than part of the shared adapter. The
adapter is linked into every plugin, so a tool it registered would be
registered once per jay plugin, and it would exist only while some jay
plugin was installed. A timer is useful without any of them.

## 2. Named timers

A session that re-sets its poll timer after every check must not pile
up timers. A name does that: setting a name that exists replaces it.
Different names run side by side, so the plugin doesn't decide how many
timers a session needs. crew's rule that a session keeps one timer for
everything it polls is crew's convention, not a limit here.

## 3. Waiting for idle

A spike sent a prompt while the session was running a command. opencode
added it to the running turn, and the model answered the new prompt and
dropped the reply it had been asked to finish. So a prompt that falls
due mid-turn is held, and delivered when the session goes idle.

The session's status comes from opencode's `session.status` and
`session.idle` events. Delivering marks the session busy at once,
before the event for the new turn arrives, so two timers due together
arrive in two turns rather than one joining the other. A repeating timer
due again while its prompt still waits replaces it, so a long turn
doesn't leave a backlog.

## 4. In memory

Timers live in opencode's process and end with it. A timer is for
something the session is doing now, and a session that restarts sets
its timers again as part of starting, as crew's roles do. Persisting
them would deliver prompts into sessions nobody has open.

## 5. Nothing for Claude Code

The plugin has no commands, skills or servers, so it would do nothing in
Claude Code. It is in the marketplace so that `./install.sh all` and
releases treat it like the others, and `install.sh` skips it for Claude
Code.
