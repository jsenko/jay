# Git

Committing, branching and opening pull requests in a coder session, and
what any session writes on GitHub.

## Commits

- Conventional prefixes: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`.
- Concise, about why rather than what.

## Branches

- Named for the change, with no type prefix such as `feat/`.
- Pushed to a fork when the project takes PRs from forks.

## Pushing

Never push without the user confirming, each time.

## Pull requests

- It compiles and its tests pass before it is opened, unless the user
  says otherwise.
- The description has its own section on impact: what changes for users,
  operators or other code.
- When a round of work has several GitHub side effects (a push, a body
  edit, a comment, replies), re-fetch each afterwards and check it
  against what was meant before calling the round done. A body drafted
  to a file but never sent looks finished until checked on the live PR.

## Public text

Commit messages, PR bodies, comments and thread replies are read by
people who have never seen the tooling, so each stands on its own. None
of them mentions crew job ids, fyi item ids, session or role names,
local paths, or finding ids from a review that was never posted.
Describe the change itself: "Fixed: `release-post-sync` runs `make
build` before `make dist`, because the CRD is generated." Check a draft
against this before it is posted.
