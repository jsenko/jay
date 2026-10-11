# Code quality: Java

Java rules on top of `~/.jay/plugins/code/rules/quality.md`, for code
whoever wrote it. Cite a rule by its ID.

| ID | Rule |
|---|---|
| J1 | **Imports,** not fully qualified names, unless two classes share a simple name. |
| J2 | **Immutable collections:** `List.of()` and `Map.of()`, not `Collections.unmodifiable*`. |
| J3 | **Absent results:** return `Optional`, not `null`. |
| J4 | **Conditional tests:** `@EnabledIf` / `@DisabledIf` with a named condition method that logs why it returned false, not `assumeTrue()`, which reports as aborted. |
