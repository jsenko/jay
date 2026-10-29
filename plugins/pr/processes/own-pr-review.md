# Reviewing the user's own PR

The user can't approve their own PR, and a review in their name on it
is noise to the other maintainers. The findings go to the session that
can fix them instead.

## Start

**Source:** `~/.jay/plugins/pr/processes/pr-review.md`, when the PR's
author is the user (`github.user` in `~/.jay/config.json`) → this reviewer
**Processed by:** this reviewer, in place of pr-review's step 7

## Steps

1. **Review as usual**: pr-review's steps 1 to 6, with the same depth,
   verification and finding ids.
2. **Post nothing to the PR**: no review, comment or verdict, whatever
   `~/.jay/plugins/pr/processes/pr-comment.md` would allow. The draft
   goes in `draft_review`.
3. **Hand the findings over**:

| Situation | Do |
|---|---|
| A code session works on the PR: `crew_who` shows its purpose, directory or repository | `crew_post` with `to` it, `needs: ["code"]` and `ref: pr:<Owner/Repo>#<n>`: each finding's id, what was verified and how, files and lines, and how the PR's pushes go (remote, sign-off). Add a `respond` attention item, `who: automation`, naming the job |
| No such session | Capture a note with the findings, linked `relates-to` the `pr` item, and add a `respond` item, `who: user`, pointing at it, for a coder session to pick up |
| Nothing worth changing | Go to 5 |

4. **Re-review each push** per
   `~/.jay/plugins/pr/processes/pr-rereview.md`: the delta, and any
   mutants that survived. Clear the `respond` item, and hand over what
   is left, until nothing is.
5. **Leave the merge to another maintainer**: a `review` attention
   item, `who: maintainer`. Their approval is the one that counts.

Then update the item per pr-review's step 8.
