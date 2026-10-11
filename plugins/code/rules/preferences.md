# Preferences

How code is written in a coder session: opinions, on top of the quality
rules. They apply to code written here, never to reviews of other
people's code. Cite a rule by its ID.

A user's `~/.jay/rules/code-preferences.md`, when it exists, replaces
this file.

## Any language

| ID | Preference |
|---|---|
| P1 | **Tests:** only for cases that matter to users, each as general as reasonable, so one test covers several things. No tests for small things that would not cause real problems. |
| P2 | **Test output** is always `tee`d to a file, so a failure can be read again without rerunning. |
| P3 | **Formatters and linters** the project uses (checkstyle, spotless) run before each commit, unless the build already runs them. |
| P4 | **Debugging:** question the expected behaviour before the code; ask when unsure. A failing test may be wrong, or expect what is no longer intended. |
| P5 | **Link, don't repeat:** an instruction or explanation lives in one place, and the others point to it. |
| P6 | **Lists** of names, fields or values that are sorted stay sorted; new lists are alphabetical unless order means something. |
| P7 | **Security:** consider the implications of every change. |

## Java

| ID | Preference |
|---|---|
| P8 | **`var`**, unless leaving the type out makes the code harder to read. |
| P9 | **Modern language features** the project's Java version supports: switch expressions, text blocks, `instanceof` patterns. |
| P10 | **Streams** where they read at least as well as a loop. |
| P11 | **Multi-line strings** as text blocks, with `formatted()` for values, not concatenated literals. |
| P12 | **Static imports** where the name stays clear. |
| P13 | **Records** for simple data with a few methods. Lombok instead when the constructor must be less visible than the class, needs logic, or there are several; for a builder; or when `equals`/`hashCode` must leave fields out or be absent. |
| P14 | **Stateful utilities** are singletons (private constructor, `getInstance()`), not classes of static fields. Static-only is for pure functions. A test singleton may use a synchronized lazy `getInstance()`. |
| P15 | **Accessors** of a data class are a chain from one source method, not repeated field access. Repeated formulas become small helpers. |
