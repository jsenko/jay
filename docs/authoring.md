# Authoring Rules

Applies when writing or editing a plugin's instruction files: anything
under `plugins/*/` in `rules/`, `processes/`, `commands/`, `skills/` or
`roles/`.

## Budgets

| File type | Limit | Why |
|---|---|---|
| `plugins/crew/rules/always.md` | 25 | Competes with the task for the whole session |
| rule | 60 | One topic, one load condition |
| process / playbook | 120 | A full workflow, steps only |
| skill (`SKILL.md`) | 120 | A playbook with a trigger description |
| command | 80 | Routing and intent; delegates the how |
| role | 60 | Identity and wiring, not procedure |

Over budget means split by load condition, or cut — not round up.

`tools/check/check.sh` checks budgets, references and frontmatter; its
README lists every check. CI runs it on each push.

## References

| To | Write |
|---|---|
| A file in any plugin, this one included | `~/.jay/plugins/<plugin>/<dir>/<file>.md` |
| A command | `/<plugin>:<command>` |
| A file from `.mcp.json` or a hook | `${CLAUDE_PLUGIN_ROOT}/<path>` |

A reference to another plugin needs that plugin in this one's
`dependencies`.

## Rules

1. **One load condition per file.** If part of a file applies only under
   a condition, split it out. The chunk boundary is the load boundary,
   not the topic. A section that is dead weight on most loads is its own
   file.

2. **Specify deviations, not defaults.** If the model would do it anyway
   unprompted, delete the line. Classifying a review comment as
   actionable-or-question needs no instruction; never posting `/merge`
   does. Same for tooling — assume `git`, `gh`, and `sed` are known, and
   document only usage that their help text would not suggest.

3. **Tables for decision logic.** Prose only for what a table cannot
   express. State transitions, event→action mappings, and field
   definitions are always tables.

4. **At most one example, and only when the format stays ambiguous
   without it.** Never illustrate what the tables above already specify
   completely.

5. **No rationale inline.** Why-it-works-this-way goes under a trailing
   `## Notes`, or into the plugin's `SPEC.md`. Operative content stays at
   the top where it is read.

6. **One way to do a thing.** No "preferred X, fallback Y" pairs once a
   tool exists. If the tool can fail, that is the tool's problem.

7. **Reference, don't restate.** Conditional references earn their
   keep — "if the PR is from a first-time contributor, follow
   `~/.jay/plugins/pr-workflow/rules/supply-chain.md`" keeps 45 lines out
   of every other review.

## Notes

Budgets are deliberately tight. Files reached 415 lines while
conciseness was only asked for, so the numbers and the check exist to
make the limit checkable rather than aspirational.

`~/.jay/plugins/<name>` is a link to the plugin's installed root, made
by each plugin's `SessionStart` hook and by the opencode adapter.
Plugins are installed under versioned cache directories, so the link is
the only path that stays the same across versions.
