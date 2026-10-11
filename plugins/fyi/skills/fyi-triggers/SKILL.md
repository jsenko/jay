---
name: fyi-triggers
description: "Notice when something is worth keeping and capture it with the fyi tools."
allowed-tools: [ ]
---

## When to use this skill

Passively, in every session. It exists because the hard part of keeping
records is not storing them — it is noticing the moment worth storing.

Conventions are in `~/.jay/plugins/fyi/rules/fyi.md`; field definitions are in
the `fyi` tool descriptions.

## Moments worth capturing

**A decision was reached.** Something was weighed and settled — an
approach chosen, a library rejected, a tradeoff accepted. Capture a
`note` with the reasoning and the project it belongs to. The reasoning
is the part that is expensive to reconstruct later.

**Work was identified but not done.** "We should also…", "that needs
fixing", "remind me to…". Capture a `task` with the date it should
resurface.

**Something took effort to establish.** A build incantation, why a test
is flaky, which service owns a config. Capture a `note` tagged `finding`.

**Something was learned that the team would want to hear.** A surprise,
a better way of doing something, how an unfamiliar system really works.
Offer a `note` tagged `learned`; status reports share these.

Tag with the well-known tags from the `tags` field description where
one fits, so the tools that read them find the item.

**Ad-hoc work has turned into a project.** It has spanned sessions, or
a design decision got made, or several related tasks appeared. Offer a
`project` — it is what makes a handoff possible, and work with no
project has no handoff. Only when it would plausibly recur; a one-off is
not a project.

**A session is ending with work unfinished.** Update the project's
`current_state` so the next session can pick it up from any directory.

**The user says to remember something.** Capture it without asking which
type — infer it, and say what was stored.

## Moments to retrieve

- "What should I work on?", "what needs me?" → `fyi_today`
- "Didn't we decide something about X?" → `fyi_search`
- Picking work back up → `fyi_handoff`
- Starting in an unfamiliar directory → search for projects linked to it

## How to offer

Propose the capture already written, as one line the user can wave
through. Do not ask which type it is, or interview them for fields.

Do not capture what the repository already records: code structure, git
history, or anything already in a rule.
