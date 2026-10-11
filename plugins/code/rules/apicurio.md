# Apicurio and Apitomy

Conventions of the Apicurio and Apitomy projects, on top of the quality
rules. Read in a repository owned by either organisation, while writing
code and while reviewing it. Cite a rule by its ID.

| ID | Rule |
|---|---|
| A1 | **Versions** are `semver4j` types in the model, parsed where they enter, never strings compared at each use (Q6, Q7). |
| A2 | **OLM and Kubernetes versions** must be semantic: coerce them to `Semver` when parsed, not when compared. |
| A3 | **Bot commands:** never post `/merge`, `/unstale` or `/reject` on a PR. A person does, always. |
