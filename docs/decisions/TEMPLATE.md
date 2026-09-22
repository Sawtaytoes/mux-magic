<!--
Copy this file to docs/decisions/YYYY-MM-DD-kebab-slug.md
The date is WHEN THE DECISION WAS MADE (commit/PR/chat date), not today.
Add an index row to README.md. Then delete this comment block and fill in
the brackets below.
-->

# YYYY-MM-DD — Short imperative title

- **Status:** Accepted
- **Date:** YYYY-MM-DD
- **Type:** web | server/api | core | tools | cli | infra | cross-repo | process | naming
- **Supersedes:** —
- **Superseded by:** —
- **Source:** worker id / PR # / commit / chat session (the paper trail)

Keep all five of `Status`, `Date`, `Type`, `Supersedes` and `Superseded by`, and keep
the `Decision`, `Context`, `Why` and `Evidence` sections below. Charcuterie's
`shared-docs-lint` reads exactly those names over the records a pull request touches,
and the job is required. Write an em dash where a field is empty. `Source` and
`What we rejected` are this repo's own additions; the lint ignores extras.

## Decision

State what was decided as a present-tense rule. 1-3 sentences.

## Context

What was happening that forced the call. The bug, the measurement, the request.

## What we rejected — DO NOT revert to this

The "no, that's wrong" content: the earlier or alternative approach that was
explicitly turned down, and the approach a future agent is most likely to
drift back toward. This is the most important section — it is why this file
exists.

## Why

The cost already paid for this decision: the bug it fixed, the workflow it
enables, the re-asking it prevents. If you believe it genuinely should
change, do NOT silently change it — write a NEW dated file that supersedes
this one (see below) and get the user's sign-off.

## Evidence

The measurement, the log line, the direct quote. This is the section that keeps
getting dropped, and it is the one that stops a future agent re-litigating a
settled call.

<!--
SUPERSESSION — when a LATER decision overrides this one:
  • DO NOT delete or rewrite this file. It stays as the historical record.
  • Change Status above to: Superseded by [YYYY-MM-DD-new-slug](YYYY-MM-DD-new-slug.md)
  • Paste the warning callout below at the TOP of this file (just under the title).
  • In the NEW file, add a "Supersedes: [link]" line and explain what changed and why.

Warning callout to paste at the top of a superseded file:

> [!WARNING]
> **SUPERSEDED on YYYY-MM-DD by [new title](YYYY-MM-DD-new-slug.md).**
> This used to be the decision. It is kept for history — do NOT implement
> what's below. The current rule is in the linked file: one-line summary.
-->
