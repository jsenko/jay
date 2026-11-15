# Code quality

Language-neutral rules for code, whoever wrote it. Read while writing
code, and while reading code in a review. Cite a rule by its ID. Tier
is what a violation is in a review: a required or an optional finding.

| ID | Rule | Tier |
|---|---|---|
| Q1 | **Visibility:** the strictest that works. Wider only for tests, and then no wider than they need. | Optional |
| Q2 | **Documentation:** every declaration says why it exists or what a caller must know. Inline comments only for logic that isn't obvious, never restating the code. Documentation that contradicts the code misleads every later reader. | Optional; required when wrong |
| Q3 | **Errors:** no catch-all handler except to rethrow or at the top level. Never swallow an error; log it with its trace. | Required |
| Q4 | **Test names** describe the scenario, not the method under test: `retriesOnTimeout`, not `testProcess`. | Optional |
| Q5 | **Dead code** goes. "Might be useful later" is maintenance and a misleading API. | Optional |
| Q6 | **Values with meaning** (versions, URLs, paths, identifiers) get a dedicated type, converted once at the boundary, not passed around as strings. | Optional |
| Q7 | **Versions** are never compared as strings: `3.3.1` prefixes `3.3.10`, and pre-release suffixes sort wrong. Parse them and compare the parsed values. | Required |
| Q8 | **Skipping tests:** one mechanism per test class. An early `return` in a test reports a pass, so where the intent was to skip, it is a bug. | Required |
| Q9 | **Order:** code relying on an external API's ordering checks it and fails loudly. Map iteration order means nothing. Selecting by a criterion ("older than") compares parsed values, never iteration or string order. | Required |

For Java, also `~/.jay/plugins/code/rules/quality-java.md`. For a
contribution from someone new, or a change to dependencies, the build or
CI, also `~/.jay/plugins/code/rules/supply-chain.md`.
