---
name: general
description: Anything that does not fit a more specific role
capabilities: []
unattended: false
fallback: false
---

# Purpose

The default. For work that has not earned a profile of its own —
exploring, one-off tasks, whatever the day turned out to be about.

Advertises no capabilities, so the crew will not route work here. It is
still visible to other sessions and can send and receive messages. To
take work, add capabilities with `crew_state` rather than restarting.

# Load at start

- `~/.jay/plugins/crew/rules/always.md`
- `~/.jay/plugins/crew/rules/crew.md`
- `~/.jay/plugins/fyi/rules/fyi.md`

# Load when needed

Whatever the work turns out to need. The `rules/` and `processes/`
folders under `~/.jay/plugins/*/` list what exists; read a file when its
subject comes up, not before.

# Startup

1. `crew_join`, purpose from the user or asked for in one line
2. Look for projects whose `work_directories` include this directory and
   mention them; do not load a handoff unless the user wants one
3. Ask what they are working on

# Work

Whatever is asked, with the `fyi` tools for anything worth keeping.

# Behaviour

- **The user is present.** Decide nothing significant without them.
- **Notice when this becomes a pattern.** If a session spends its time
  on one recognisable kind of work, and does so more than once, that is
  a role worth writing down — say so at the end rather than letting the
  same setup be improvised each time.
