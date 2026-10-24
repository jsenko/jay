# code

Writing code with Claude, the way its author does:

- **The `coder` role:** start a session with `/crew:start coder` and it
  finds the project for this directory, picks up where the last session
  stopped, and works alongside you.
- **`/code:implement`:** one command for work of any size. A fix gets no
  tracking; a feature gets a design note; something spanning several PRs
  gets phases. It escalates if the work turns out bigger than it looked.
- **Rules with stable IDs** for code quality, which reviews can cite
  ("Q7") and which you can replace where they're only opinion.

It needs [fyi](../fyi/README.md), where projects, decisions and tracking
files live, and [crew](../crew/README.md), for the role.

## Installing

From a clone of jay:

```bash
./install.sh code
```

This installs code, crew and fyi. Without a clone, in Claude Code:

```
/plugin marketplace add jsenko/jay
/plugin install code@jay
```

The [main README](../../README.md) covers the permissions to add then,
updating and uninstalling.

In opencode, `./install.sh --opencode code` installs it from the clone;
the command is `/code-implement` and the skill `code-style` there.

## Using it

```
/crew:start coder
/code:implement #1234
/code:implement make the retry back off exponentially
```

`/code:implement` takes an issue, a PR that needs changes, or a
description. It picks the weight, sets up a branch, and works in a loop:
build, read its own diff against the rules, and ask before committing.
It never pushes without asking. Once a PR is open it watches review
comments and CI, and prepares fixes and replies for you to send.

**Tracking.** Work above a quick fix gets a project in fyi, with its
files (`DESIGN.md`, `TASKS.md`, and for phased work `PLAN.md` and
`PHASE-<n>.md`) in the project's folder, linked into the checkout as
`.projects/<name>`. Add `.projects` to the repository's `.gitignore`.
Decisions are fyi notes against the project, which is what lets the next
session pick the work up from any directory. When a plan settles, the
session offers to turn it into GitHub issues, shaped in three layers:
area epic, milestone epic and work issues. Work that moves existing code
to a decided target state, such as adopting a helper across a test
suite, gets an adoption epic instead: the target state, the decisions,
and ordered items ending in a written convention.

## Rules

| File | IDs | What | Applies to |
|---|---|---|---|
| [`quality.md`](rules/quality.md) | Q | Language-neutral quality | Writing and reviewing |
| [`quality-java.md`](rules/quality-java.md) | J | Java | Writing and reviewing Java |
| [`supply-chain.md`](rules/supply-chain.md) | SC | Signs of a malicious change | Dependency, build and CI changes; newcomers' contributions |
| [`apicurio.md`](rules/apicurio.md) | A | Apicurio and Apitomy conventions | Their repositories |
| [`preferences.md`](rules/preferences.md) | P | The author's opinions | Code written in your sessions only |
| [`git.md`](rules/git.md) | — | Commits, branches, PRs | Your sessions |

An ID is never renumbered or reused, so "Q7" in a review comment means
the same thing a year later. A retired rule keeps its row, marked
retired.

**jay is opinionated.** The preferences are its author's, and they apply
only to code your own sessions write, never to reviews of other people's
code. To use your own, write `~/.jay/rules/code-preferences.md` in the
same format; when it exists, it replaces `preferences.md` entirely.

**The Apicurio rules** load only in repositories of the Apicurio and
Apitomy organisations, since the first users of jay work there. Rules
for one project are often better kept in that project's own `AGENTS.md`
or `CLAUDE.md`, where every contributor's tools find them.

In a session that isn't a coder, the `code:style` skill loads the same
rules whenever code is written.

## Building and testing

code is instructions only: a role, a command, rules and processes.
`tools/check/check.sh` at the repository root checks their structure,
references and length. To try a change, install from a clone with
`./install.sh --dev code` and restart Claude Code.

The design is in [SPEC.md](SPEC.md).
