# timer

Timers for opencode sessions. A session sets one, and when it is due,
the timer sends its prompt into the session as a message, once or
repeating. A session can then poll on its own, check back on a build, or
remind itself of anything, without waiting for you to type.

Claude Code has timers of its own, so this plugin is for opencode only.
It needs no other jay plugin, and other plugins don't need it: crew and
the pr watcher use whatever timer the client gives them, and in opencode
that is this one.

## Installing

From a clone of jay:

```bash
./install.sh --opencode timer
```

`./install.sh all` includes it, and installs it only for opencode. It
writes `~/.config/opencode/plugins/jay-timer.js`, pointing at the
plugin in the clone, and installs its npm dependencies there. Restart
opencode to load it.

## Using it

Three tools, each acting on the calling session's own timers:

| Tool | Does |
|---|---|
| `timer_set({name, minutes, prompt, repeat?})` | Sends `prompt` after `minutes`, or every `minutes` with `repeat`. Setting a name that exists replaces it |
| `timer_cancel({name})` | Cancels a timer, and a prompt of its still waiting |
| `timer_list()` | The session's timers, soonest first, with the minutes left |

Ask for it in plain words, such as "check the CI run in ten minutes",
and the session sets the timer. A prompt arrives marked
`[timer <name>]`, so the session can tell it from you.

**A busy session isn't interrupted.** A prompt that falls due mid-turn
waits until the turn ends, and when several are waiting, they arrive
one turn at a time.

**Timers last as long as opencode does.** They are kept in opencode's
process: closing opencode ends them, and nothing is written to disk.

## Building and testing

```bash
npm install
npm test
```

The tests drive the timers with very short delays and a fake send. What
can't be tested this way, opencode delivering the prompt, is in the
[manual test pass](../../docs/test-pass.md).

## Configuration

None.
