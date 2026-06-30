# 2026-06-30 — cleanupFilename: a colon-space becomes " - " (even after ")"), not narrowed to word chars

- **Status:** Accepted — code currently narrowed; **fix needed** (revert to the blanket rule)
- **Date decided:** 2026-06-30
- **Area:** core / tools
- **Source:** user 2026-06-30; `packages/tools/src/cleanupFilename.ts`

## Decision

In `cleanupFilename`, a colon **followed by a space** (`": "`) is a title separator and must become `" - "` (space, dash, space) **regardless of the preceding character** — including after `)`, `]`, `"`, etc. A colon **not** followed by a space (e.g. `4:3`, `12:30`) becomes `"-"` with no surrounding spaces.

Recommended implementation (this is the v1.0.0 behavior):

```ts
.replaceAll(/: /g, " - ")   // any colon-space → " - "
.replaceAll(/:/g, "-")      // any leftover colon → "-"
```

## What we rejected — DO NOT revert to this

Do **not** narrow the colon-space rule to fire only after a word character (`/(\w): /`). That guard exists in the current code and its *only* observable effect is degrading the punctuation-before-colon case: `Episode (Part 1): The End` becomes `Episode (Part 1)- The End` (missing the leading space) instead of `Episode (Part 1) - The End`. It improves no title. `)` is not a word character and must not be folded into `\w` — any colon-*space* is a separator, full stop. (Likewise don't try to enumerate an "explicit allow-list" of preceding punctuation; the blanket colon-space rule is simpler and can't miss a character.)

## Why it must not be re-litigated

This rule already flip-flopped once (blanket → `\w`-narrowed), producing subtly weird renames like `(2020)- Director's Cut` across the TV / anime / movie-naming commands that all run titles through `cleanupFilename`. Titles such as `Movie (2020): Director's Cut` must read `Movie (2020) - Director's Cut`. A future agent diffing against v1.0.0 will see the `\w` form and might "restore" it as the newer version — don't; the blanket colon-space rule is correct.
