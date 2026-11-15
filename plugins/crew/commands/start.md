---
description: Start this session as a role
argument-hint: <role> [purpose]
---

# Overview

Start this session as a role: a profile saying what the session is for,
what it advertises to the crew, what to load, and how autonomously to
act. A role is `<name>.md` in one of:

| Where | Holds |
|---|---|
| `~/.jay/roles/` | The user's own roles. One here wins over a plugin's of the same name |
| `~/.jay/plugins/*/roles/` | Roles from installed plugins |

No `~/.jay/plugins/` at all means the plugins' `SessionStart` hooks have
not run, for example with hooks disabled. Say so and stop.

# Input

Arguments: $ARGUMENTS — the role name, then an optional purpose.

No role given? Use `general`, and say which others exist in one line;
starting never requires a menu. An unknown name is an error, listing
what exists.

# Process

1. **Read the profile.** Its frontmatter gives `capabilities`,
   `unattended` and `fallback`; its sections give the rest.
2. **Join the crew:** `crew_join` with the purpose (the user's, else the
   profile's description), the role's name as `role`, and the profile's
   `capabilities` and `fallback`. On `notifications: "poll"` with capabilities, set a timer
   per `~/.jay/plugins/crew/processes/polling.md`; on `"channel"`, wait to be woken.
3. **Load** everything under the profile's **Load at start**. Not its
   **Load when needed** files: those are for the moment they apply.
4. **Follow the profile's Startup section**, for an `unattended` role
   after reading where the last one stopped, per
   `~/.jay/plugins/crew/processes/session-pickup.md`.
5. **Report:**

```
<name> session ready.
  Session:       <session-id>
  Directory:     <cwd>
  Repository:    <Owner/Repo, or none>
  Crew:          <role>, advertising <capabilities>
  Notifications: <channel | poll>
  Polling:       <only with poll: timer 'poll' in <n> min | none: checks only when you write>
  <whatever the profile's startup found>
  <each of crew_join's warnings, one line>
```

Keep the `Session:` line first, whatever the startup adds: the user
names it to send work here. Keep the rest short: a wall of text spends
the user's attention first.

6. **Offer an earlier session** to pick up, for an attended role, per
   `~/.jay/plugins/crew/processes/session-pickup.md`.

# Behaviour for the rest of the session

The profile's **Work** and **Behaviour** sections apply until the
session ends.

`unattended` says what happens when nobody is watching: act on claimed
work and keep going, or wait for the user. It is not a locked mode.

**The user being present always takes precedence.** An unattended
reviewer that the user starts talking to defers to them, and sets
`crew_state({status: "focus"})` so work is not routed in behind their
back, until they leave or 30 minutes pass with no prompt from them.

**Changing what this session takes** is `crew_state({capabilities})`,
with no restart. Changing what it *knows* needs a new session: read
context cannot be unread, so switching roles in place gives the union.

Set `crew_state` whenever the activity changes materially; other
sessions route work by it.
