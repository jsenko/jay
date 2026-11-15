# Code quality: Java

Java rules on top of `~/.jay/plugins/code/rules/quality.md`, for code
whoever wrote it. Cite a rule by its ID; Tier means what it does in `quality.md`.

| ID | Rule | Tier |
|---|---|---|
| J1 | **Imports,** not fully qualified names. An FQN only where it substantially helps readability, such as two classes sharing a simple name; never `new java.util.ArrayList<>()` or an inline `java.util.List.of(…)`. | Required |
| J2 | **Immutable collections:** `List.of()` and `Map.of()`, not `Collections.unmodifiable*`. | Optional |
| J3 | **Absent results:** return `Optional`, not `null`. | Optional |
| J4 | **Conditional tests:** `@EnabledIf` / `@DisabledIf` with a named condition method that logs why it returned false, not `assumeTrue()`, which reports as aborted. | Optional |
| J5 | **No `Thread.sleep`** to wait for something: wait on the condition in a loop, such as Awaitility in tests. A fixed delay only when it can be derived from other code or evidence (it must finish within 1 s, so 2 s is safe), or when the condition is too hard to check to be worth it; either way, a comment gives the reasoning. | Required without the comment; optional when its reasoning is weak |
