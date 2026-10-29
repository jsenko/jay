# Session save

Saving where a session stopped, so a later `/crew:start` can offer to
pick it up. A project's `current_state` covers project work; this covers
the session, project or not.

## Start

**Source:** `/crew:stop`, step 1 → this session
**Processed by:** this session, once, after `current_state` is written

| Session | Then |
|---|---|
| Attended: its role is not `unattended`, or the user drove it at some point (it set `focus`) | Ask first, below |
| `unattended` throughout | Write without asking, when anything would be lost |

An `unattended` role keeps **one note per role and place**: its
repository, or its directory when it has none. Update the note pickup
read at startup, or the newest that matches, with `fyi_update`, rather
than capturing a second; a new note only when none exists.

Ask in one line, since writing the note costs a summary's worth of work
the user may not want:

```
Save this session to pick up later? <yes or no>: <why, in a few words>
```

Suggest no when the project's `current_state` already says where it
stopped, or when the session did nothing worth resuming: a question
answered, a status checked. Suggest yes when half-done work lives only
in this conversation. Write the note only on a yes.

## Write the note

`fyi_capture` a note:

| Field | Value |
|---|---|
| `title` | `Session: <role> in <directory name> — <purpose>`; for an `unattended` role, without the purpose |
| `tags` | `session` and the role's name |
| `archive_after_days` | `sessions.keep_days` in `~/.jay/config.json`, else 7 |
| `links` | `relates-to` the project, when one is in play |
| `paths` | The directory, and any files central to the work |

Leave `project` unset: notes with a project are its decision log.

`content`, written as if for a compaction summary, for a session that
has none of this context:

```markdown
role: <role>
directory: <absolute path>
repos: <Owner/Repo, comma-separated, or none>
project: <project id, or none>
purpose: <the purpose the session joined with>

## Where it stopped
<What was done, what is half done, the branch and uncommitted state.>

## Next
<The next steps, in order. Pending actions by their task ids, not restated.>

## Open
<Questions for the user, decisions pending, anything promised.>
```

Say in the stop report that it was saved, and for how long.
