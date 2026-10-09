# Authoring Rules

For writing an instruction file (a role, rule, process, command or
skill), in a plugin or among your own files under `~/.jay/`.

## Budgets

| File type | Limit | Why |
|---|---|---|
| crew's `rules/always.md` | 25 | Competes with the task for the whole session |
| rule | 60 | One topic, one load condition |
| process / playbook | 120 | A full workflow, steps only |
| skill (`SKILL.md`) | 120 | A playbook with a trigger description |
| command | 80 | Routing and intent; delegates the how |
| role | 60 | Identity and wiring, not procedure |

Over budget means split by load condition, or cut — not round up.

## References

| To | Write |
|---|---|
| A file in any plugin, this one included | `~/.jay/plugins/<plugin>/<dir>/<file>.md` |
| One of your own files | `~/.jay/<dir>/<file>.md` |
| A command | `/<plugin>:<command>` |
| A file from `.mcp.json` or a hook | `${CLAUDE_PLUGIN_ROOT}/<path>` |

A plugin referring to another plugin needs it in its `dependencies`.

## Rules

1. **One load condition per file.** The chunk boundary is the load
   boundary, not the topic: a section that is dead weight on most loads
   is its own file.
2. **Specify deviations, not defaults.** If the model would do it anyway
   unprompted, delete the line. Never posting `/merge` needs saying;
   reading a review comment does not. Assume `git`, `gh` and `sed` are
   known, and document only what their help would not suggest.
3. **Tables for decision logic.** State transitions, event → action
   mappings and field definitions are always tables; prose only for
   what a table cannot express.
4. **At most one example,** and only when the format stays ambiguous
   without it.
5. **No rationale inline.** Why goes under a trailing `## Notes`, or in
   the plugin's `SPEC.md`. Operative content stays at the top.
6. **One way to do a thing.** No "preferred X, fallback Y" pairs once a
   tool exists.
7. **Reference, don't restate.** A conditional reference ("when
   something is worth keeping, follow `~/.jay/plugins/fyi/rules/fyi.md`")
   keeps a whole file out of every load where the condition is false.
