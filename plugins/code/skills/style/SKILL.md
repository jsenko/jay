---
name: style
description: "Apply the code-quality rules and coding preferences while writing or changing code, in any session."
---

## When to use this skill

Whenever code is being written or changed, in a session that has not
already loaded the rules, such as one not started as the coder role.

## What to load

| When | Read |
|---|---|
| Any code | `~/.jay/plugins/code/rules/quality.md` |
| Java | `~/.jay/plugins/code/rules/quality-java.md` |
| A change to dependencies, the build or CI | `~/.jay/plugins/code/rules/supply-chain.md` |
| An Apicurio or Apitomy repository | `~/.jay/plugins/code/rules/apicurio.md` |
| Code written in this session | `~/.jay/rules/code-preferences.md` if it exists, else `~/.jay/plugins/code/rules/preferences.md` |

The preferences apply only to code written here, never when reviewing
someone else's.

When something is fixed because of a rule, cite its ID.

For more than a small change, suggest `/code:implement`, which adds
building, a self-review of the diff, and tracking where the work needs it.
