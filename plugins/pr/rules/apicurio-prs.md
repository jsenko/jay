# Apicurio PRs

The Apicurio project's PR conventions, which
`~/.jay/plugins/pr/rules/pr-interest.md` and the PR processes run
against. Another project needs its own version of this file.

## Upstream is the source of truth

Most of what this file used to duplicate lives in the project, is public,
and is maintained by people other than the user. Read it there rather
than restating it:

| What | Where |
|---|---|
| Who the maintainers are | [`MAINTAINERS.md`](https://github.com/Apicurio/apicurio-registry/blob/main/MAINTAINERS.md) |
| Who gets which PRs, and their area interests | `.github/pr-lifecycle.yml`, `reviewer_assignment.reviewers` |
| Which bots are rotated | same file, `reviewer_assignment.bot_rotation` |
| Which bots are auto-accepted | same file, `auto_accept` |
| Accounts exempt from the one-PR limit | same file, `pr_limit_exempt` |
| The area label taxonomy | `.github/label-descriptions.yml` |

The user's own declared areas are in `reviewer_assignment.reviewers`
under their handle. Those weights decide what gets routed to them, which
is what makes "track what is assigned" sufficient.

## Conventions

**The user** is `github.user` in `~/.jay/config.json`.

**Bots are not skipped.** They are assigned like anything else, rotated
to spread them evenly, so a bot PR assigned to the user is theirs to
handle. An earlier version of this file skipped them, which would have
dropped work the router had deliberately handed over.

**Maintainer-only labels:** `area/CI` and anything nested under it, such
as `area/CI/automation`. Nesting inherits the restriction even when a
child is added by hand without its parent.

**Lifecycle labels** drive PR state, and this is the part that does not
generalise — a project without them needs `~/.jay/plugins/pr/processes/pr-events.md`
changed, not just this file.

| Label | State |
|---|---|
| `lifecycle/ready-for-review` | ready-for-review |
| `lifecycle/ready-to-merge` | ready-to-merge |

`lifecycle/tested` and `lifecycle/full-verified` are CI signals, not
states.

**Gates:** `Verification Gate` stays pending until a maintainer runs
`/verify`, so pass it in `gates` to `get_check_status`: its failure is
not a CI failure.
