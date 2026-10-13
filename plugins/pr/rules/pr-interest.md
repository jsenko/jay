# PR Interest

Whether a pull request is worth tracking, and how much it matters.
Evaluated by the watcher on every PR event.

## Assignment does most of the work

Since #10248 every PR gets a reviewer automatically — contributor PRs by
ownership, area interest and load; bot PRs rotated to spread them evenly.
So the primary rule is short:

**Track what is assigned to the user.** The upstream router has already
weighed who should look at a PR, using a richer model than this file
could restate. Duplicating its area and contributor matching here would
be a second copy that drifts.

Importance follows from the same source: the strongest signal is that
someone — a person or the router — put it on the user's plate.

## Exceptions

Track these whoever they are assigned to, because the router cannot see
them:

| Exception | Why it is not assignment |
|---|---|
| The user is **@mentioned** | Someone asked them directly. The strongest signal there is, and it can land on a PR nothing else would track |
| The user is a **requested reviewer** | A person asked, explicitly, which outranks a routing score |
| The user has **already commented** | A conversation in progress is not reassigned |
| It closes an **issue the user filed** | They defined the problem, whoever implements it |
| **Security or a breaking change** | Matters regardless of who holds it |
| Assigned to **someone else**, and the user has context | Track at low importance; do not review unless asked |

**Unassigned is a defect, not a triage task.** Assignment happens on open
and undraft, so one still unassigned means the job failed — worth a look
at the job, not an `assign` item on the PR.

## Importance

| Level | When |
|---|---|
| critical | The user authored it, or it is security or a breaking change |
| high | Mentioned, assigned, a requested reviewer, or it closes their issue |
| medium | They have commented on it, or hold context on it |
| low | Assigned to someone else with nothing else matching |

## Drafts

Not tracked unless high or critical, and never delegated for review
until marked ready. Assignment also waits for undraft.

## Notes

The interest *criteria* are here. The project they run against is
`~/.jay/plugins/pr/rules/apicurio-prs.md`, and the user is `github.user`
in `~/.jay/config.json`.

With routing automated, **mentions and comments are becoming the part
that needs a person**, more than PRs as such. The rules above weight
them accordingly, and this is the area to expect to change with use.
