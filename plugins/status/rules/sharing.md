# Sharing

What goes into a status, and what is asked about first. Both
`/status:brief` and `/status:weekly` apply it to the gathered digest
before writing.

## Purpose

A status tells the team the interesting things the user did: what moved,
what was decided, what was learned, and who they worked with. The test
for an item is whether a teammate would want to hear it, not whether it
left a trace.

Interaction with others counts as much as code: a discussion that
settled a design, help given to a contributor, a question answered on an
issue or in GitHub Discussions. Say what came of it, not that it
happened.

## Ask first

Ask in one batched question, before writing:

| Activity | Why |
|---|---|
| Looks personal: a repository outside the organisations most of the period's work is in | It may be worth sharing, or none of the team's business |
| Security-sensitive and not public: a private repository about security, a draft advisory or `-ghsa-` fork, an embargoed fix, CVE or vulnerability wording on a private item | Reporting it can disclose what is not public yet |
| Anything else where it is unclear whether the team would care | A question costs less than a status that overshares |

Offer each as a short choice: include, include without detail, or leave
out. An answer holds for the rest of the session. A standing preference
the user states ("always include project X") is kept as a note tagged
`decision` and `status`; the gathering reads those before asking.

## Leave out

- Bot activity, and automated PRs such as dependency bumps, unless the
  user did real work on one
- Other people's work the user took no part in
- Implementation detail: say what changed and why it mattered
