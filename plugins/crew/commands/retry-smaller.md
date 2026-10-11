---
description: Retry after a response was refused for being too large, doing the same work in smaller pieces
---

# Overview

Run this after a provider refuses a response — in opencode, *"the
response was blocked by the provider's content filter"*, which in
practice usually means too much went in at once.

The session cannot see this happen: its own response never arrived, so
from its side nothing went wrong. That is why this is invoked rather than
triggered.

# Process

## 1. Find what was too big

Look back at the last few tool calls, not the last message. Usually one
of:

| Cause | Instead |
|---|---|
| A whole large file read | `wc -l` first, then read a range; or grep for the part that matters and read around the hits |
| Several files at once | Grep across them, then open only what hit |
| A large command output | Bound it — `head`, `tail`, `grep`, `wc`. Or redirect to a file and read selectively |
| A whole tree listing | `find` with filters, never `ls -R` on a big tree |
| Producing a long document | Write it in sections, appending, rather than in one response |

**Do not retry the same call.** It will not fit the second time.

## 2. Check whether it is already in context

If the oversized content landed in the conversation before the refusal,
reading it again doubles the problem. Work from what is there, or move
on without it.

## 3. Narrow the task, not just the read

A task needing most of a large file in view is usually several tasks. Do
the first one, record what was learned, then do the next.

## 4. When it keeps failing

Context is already too full to recover in place. Stop and start a fresh
session on a narrower piece.

Carry the context properly rather than re-deriving it: write the
project's `current_state`, capture any decision as a note, and let the
next session open with `fyi_handoff`. That is what it is for.

# Notes

Tool results are a common cause, so the MCP servers here keep them
small deliberately — `crew_poll` returns `{}` when idle and `fyi_search`
returns summaries rather than whole items. A server that dumps its whole
state into a reply is a size limit waiting to happen, and more so on
providers with tighter limits than Claude's.
