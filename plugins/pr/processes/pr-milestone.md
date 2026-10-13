# PR Milestone Assignment

Ensures every PR has a milestone assigned for release note generation.
Referenced by `~/.jay/plugins/pr/processes/pr-events.md` and `~/.jay/plugins/pr/processes/pr-preflight.md`.

## Determination

1. Get the PR's base branch (e.g. `main`, `3.2.x`)
2. Fetch version from `pom.xml` on that branch:
   ```bash
   gh api repos/{owner}/{repo}/contents/pom.xml?ref={base} \
     --jq '.content' | base64 -d | grep -m1 '<version>' \
     | sed 's/.*<version>//;s/<.*//'
   ```
3. Strip `-SNAPSHOT` suffix -- `3.4.0-SNAPSHOT` becomes `3.4.0`

## Skip Conditions

Do not assign a milestone if:

- PR already has a milestone
- PR was closed without merging (merge trigger only)
- PR is a draft

## Assign

1. Check if milestone exists:
   ```bash
   gh api repos/{owner}/{repo}/milestones --jq '.[] | select(.title == "{version}")'
   ```
2. If not found, create it:
   ```bash
   gh api repos/{owner}/{repo}/milestones -f title={version}
   ```
3. Assign to the PR by milestone number, through the issues endpoint.
   `gh pr edit --milestone` fails on the Projects (classic) deprecation.
   ```bash
   gh api -X PATCH repos/{owner}/{repo}/issues/{number} -F milestone={milestone_number}
   ```
   One plain call per PR or issue, exactly in this form: no loop, pipe or
   `--jq`. The allow rule for it matches only this shape, and anything
   else is refused as an external write in an unattended session. If it
   is refused anyway, don't try another way: add an `assign` attention
   item, `who: user`, naming the milestone, and carry on.
4. Do the same for every open issue the PR closes that has no open
   milestone — PR validation fails until they have one. List them with
   GraphQL `closingIssuesReferences`; `gh pr view` lacks the field.

## Event-Action Rules

### PR merged

**Source:** GitHub `PullRequestEvent` (action: closed, merged: true) via MCP server -> watcher
**Processed by:** watcher

1. Skip if PR already has a milestone
2. Determine version from base branch
3. Assign milestone

### New PR tracked

**Source:** watcher New PR Triage
**Processed by:** watcher

1. Skip if PR already has a milestone or is a draft
2. Determine version from base branch
3. Assign milestone

### Preflight

**Source:** `~/.jay/plugins/pr/processes/pr-preflight.md` step 3 — reviewer, watcher sweep,
or `/pr:checkout`
**Processed by:** whichever of them is running it

1. Skip if PR already has a milestone or is a draft
2. Determine version from base branch
3. Assign milestone
