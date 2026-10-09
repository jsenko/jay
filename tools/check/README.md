# check

Structural checks over the marketplace and its plugins. Needs bash and
node; it also runs `claude plugin validate` when `claude` is installed.
CI runs it on every push to main.

```bash
tools/check/check.sh            # full output, exit 1 on errors
tools/check/check.sh --quiet    # findings only
```

## What it checks

| Check | Catches | Severity |
|---|---|---|
| **Manifests** | A plugin missing from the marketplace or listed without its directory; a `plugin.json` that misnames itself, has no version, or depends on a plugin not in this marketplace | error |
| **Budgets** | An instruction file past the line limit for its kind (crew's `rules/authoring.md`) | warning |
| **File references** | A `~/.jay/plugins/<p>/…` path to a file that does not exist, or into a plugin this one does not depend on | error |
| | A reference into the old `~/.fyi/work/` layout | warning |
| **Command references** | `/<plugin>:<name>` with no command or skill behind it, or in a plugin this one does not depend on | error |
| | An old `/j:` command | warning |
| **Role frontmatter** | A missing key, a `name` that disagrees with the filename, an `unattended` that is not a boolean, or a capability crew does not define | error |
| **Command and skill frontmatter** | A missing `description`, without which Claude Code cannot list it | error |
| **Orphans** | A rule or process nothing points at: dead, or loaded by an unwritten convention | warning |
| **Shared copies** | A file from `tools/plugin/` missing from a plugin, or changed there instead of in the master | error |
| **Dashboards** | A plugin with a dashboard whose root `package.json` is not an ES module or lacks tsx | error |
| **MCP servers** | A server command in `.mcp.json` that does not exist once dependencies are installed | error |
| **claude plugin validate** | Anything Claude Code itself rejects in the marketplace or a plugin | error |

The warnings for the old layout and old commands are there for the
migration from ai-resources. A plugin that moves before the files it
references keeps working through the old paths, and the warning lists
what to update once they move.

## Why

Renames leave pointers behind, and in ai-resources every instance was
found by a grep someone happened to run. Plugins add a second kind of
mistake: a reference into a plugin that is not a dependency works on the
author's machine, where everything is installed, and fails for a user
who installed only one plugin.

The capability check reads the enum from crew's server rather than
restating it, so a typo in a role fails here instead of silently never
matching at routing time.

## Extending

One function per check, each reporting through `err` and `warn`. Add a
function, then call it in the report section at the bottom.
