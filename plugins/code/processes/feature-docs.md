# Feature Documentation

Writing the documentation a feature ships with. Read when writing or
reviewing user-facing docs, not before.

## Start

When a feature is close to complete, or when the developer asks for
documentation.

## Audiences

Write for one audience per document. A document serving all three serves
none of them.

### End users

Want to *use* the feature. Not deploying it, not implementing it, and
may not know the system well.

Include: what it does and why it helps; quick start; examples; anything
that affects whether to use it; brief troubleshooting.

### Developers

Want to implement, extend or debug it. Know the system, not this
feature.

Include: design and architecture; the components and how they interact;
how to set up and test locally.

Exclude: what the code already says. Javadoc and snippets belong in the
codebase unless a snippet is explaining the design.

### Administrators

Want to evaluate and deploy it. Know the concepts, not the internals.

Include: configuration; how test and production setups differ; usage
examples that are not code; limitations; anything affecting a deployment
decision; brief troubleshooting.

Exclude: implementation detail.

## Practices

- **Cross-reference rather than repeat.** Each audience's document links
  to the others instead of restating them.
- **Test every command** before it goes in.
- **Diagrams where they earn it.** ASCII is fine; decoration is not.
- **Preserve the developer's voice** when editing something they wrote.

## Where docs live

Next to what they describe — the implementation or its tests — not in a
documentation directory far from the code. Several may exist for
different components.
