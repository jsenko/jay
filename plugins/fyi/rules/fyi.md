# FYI Rules

What to capture and when. The `fyi` MCP server owns the format, the
fields and the validation — read its tool descriptions for those.

## What goes where

| Kind of thing | Type |
|---|---|
| Needs doing, with a date to look at it again | `task` |
| A decision and why it was made | `note`, with `project` set |
| Worth remembering, no action | `note` |
| Work spanning more than one session | `project` |
| A pull request being tracked | `pr` |

**No next action date means it is not a task.** If there is nothing to
do on a date, it is a note. Do not invent a deadline to satisfy the
field.

**Well-known tags** mean the same to every tool and plugin that reads
them; the `tags` field description lists them. Use one rather than a
synonym. A decision is a note with a project, tagged `decision` rather
than titled "Decision: …": in date order, the project's decision log.

## When to capture

Capture when something will outlive the session and is not already
recorded:

- a decision, with the reasoning — especially one taken after discussion
- work identified but not done now
- a fact about the environment that took effort to establish

Search before creating. Updating an existing item usually beats adding a
second one about the same thing.

**Offer, do not interrogate.** When something is worth capturing,
propose it already written — a title and body the user can accept in one
word. A capture that costs a conversation does not happen twice.

## Not session memory

Capture here rather than in session memory. Memory is scoped to one
directory and invisible to every other session; an item is reachable from
anywhere and survives the session that wrote it.

## Scope

Leave `scope` out unless the item belongs elsewhere: a work thread that
turns up a personal errand still captures it, with `scope: "personal"`.

Read with `scope: "all"` only when the question genuinely spans several.

## Archiving

Finished work archives itself, and a project's notes leave with it;
there is no cleanup to run. Set `pinned: true` on anything recurring
that should stay active regardless of status.

Nothing is deleted. Archiving is how things are removed from view.
