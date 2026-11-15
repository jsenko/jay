# PR Interest: repositories with no router

What to track in a watched repository that assigns nobody. Read in place
of `~/.jay/plugins/pr/rules/pr-interest.md`'s assignment rule, for a PR
in such a repository; its exceptions, importance levels and drafts rule
still apply except where this says otherwise.

## Which repositories

One with no `.github/pr-lifecycle.yml` on its default branch has no
router: `gh api repos/<owner>/<repo>/contents/.github/pr-lifecycle.yml`
answers 404. Check once per repository per session.

Nothing there is ever assigned, so tracking only assigned PRs would
track none, and PRs wait for months with nobody answering.

## Track

| PR | Track |
|---|---|
| Not a draft | Always, at least `medium` |
| A draft | Only once stale, at `low` |

Unassigned is expected here, not a defect.

## Stale

A PR with no activity from a maintainer for more than 14 days is stale:
no review, comment or commit by someone with write access (an
`author_association` of `OWNER`, `MEMBER` or `COLLABORATOR`), counted
from the latest of those, or from opening when there is none. Give it a
`stale` attention item, `who: maintainer`, saying how long it has
waited, and remove the item when a maintainer acts.
