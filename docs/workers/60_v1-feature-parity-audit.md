# Worker 60 — v1-feature-parity-audit

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/60-v1-feature-parity-audit`
**Worktree:** `.claude/worktrees/60_v1-feature-parity-audit/`
**Phase:** 3 (regression sweep — sister of worker 59)
**Depends on:** —
**Parallel with:** everything (research/audit worker; produces docs only).

---

## Universal Rules (TL;DR)

Worktree-isolated. Yarn only. See [AGENTS.md](../../AGENTS.md). **This worker writes docs, not code** — pre-merge gate is just `yarn lint` to keep markdown consistent.

---

## Your Mission

**Audit the `server-v1.0.0` tagged release against the current `feat/mux-magic-revamp` branch to find every user-visible feature that existed in v1.0.0 but is missing or regressed in the React app.** Worker 59 was triggered by one such regression (the deleted Smart Match modal); the user's instinct is *"there were probably more I never tested"*. This worker confirms or rejects that instinct exhaustively.

The output is a markdown report plus one follow-up worker doc per confirmed missing feature, slotted into the manifest as `ready` (or `planned` if it depends on something not yet built). **No code restoration in this worker** — the work is detection, evidence, and triage. Restoration happens in the per-feature follow-up workers (so each lost feature gets its own focused PR with its own tests).

### The baseline

- **Reference tag:** `server-v1.0.0` (commit `ff92625b`, dated 2026-05-09). This is the last commit with the legacy vanilla-JS builder fully present at `packages/web/public/builder/`. The day after (commit `28534ec5`), the entire `public/builder/` and `public/vendor/` trees were deleted on the rationale that *"the React app no longer references"* them.
- **Current state:** `feat/mux-magic-revamp` (whatever HEAD is when this worker starts).

### Why this audit is needed

The user discovered the missing Smart Match modal (now Part B of worker [58](58_promptmodal-cancel-and-play-fix.md)) by accident while exploring why worker 25 couldn't extend it. The deletion commit (`28534ec5`) removed ~30+ JS components and helpers in one sweep. The commit message says the React app didn't reference them — but the spot-check that found this regression suggests *some* of those files implemented features the React app **also** doesn't have, the assumption was wrong, and nobody noticed because no one re-ran the full v1.0.0 feature surface in the React app after the cut-over.

### Known confirmed regressions (already triaged elsewhere — do not re-file)

These were discovered during the worker-58/59 triage and are already absorbed into worker 58's scope. List them at the top of the audit report under "Already triaged" so reviewers can see worker 58 picked them up:

- **PromptModal `▶ Play` button silently no-ops** — `window.openVideoModal` registered inside `FileExplorerModal` only fires when the explorer is open. Worker 58 Part A.
- **PromptModal has no explicit cancel-out** — backdrop-click and Escape leave the server-side observable suspended. Worker 58 Part A.
- **Smart Match / Fix Unnamed batch modal missing** — built in `a7fef431`, deleted in `28534ec5`, never ported. Worker 58 Part B.
- **NSF dry-run / fake-mode doesn't fire interactive prompts** — fake scenario at [packages/server/src/fake-data/scenarios/nameSpecialFeaturesDvdCompareTmdb.ts:125-126](../../packages/server/src/fake-data/scenarios/nameSpecialFeaturesDvdCompareTmdb.ts#L125-L126) explicitly auto-skips. v1.0.0 fired the same prompts a real run would, which was the only way to QA the interactive flow without a real DVD rip. Worker 58 Part C.

Treat these as **known-positive anchors** for the audit's calibration: if your method doesn't surface all four when run against `server-v1.0.0`, the method has a gap.

### How to audit

This is a **structured diff** of two surfaces, not a vibes pass. Use these axes:

#### Axis 1 — Component-level

Enumerate every component in the legacy tree at the v1.0.0 tag:

```sh
git show --name-only server-v1.0.0 -- packages/web/public/builder/js/components/ 2>/dev/null
# or, since v1.0.0 is a merge commit, list the tree:
git ls-tree -r --name-only server-v1.0.0 -- packages/web/public/builder/js/
```

For each component, find the matching React component (if any). Score:

- **Ported** — equivalent React component exists, same user-visible behavior. Note the file path mapping.
- **Partially ported** — React component exists but is missing specific features the legacy version had. List each missing feature.
- **Missing entirely** — no React equivalent. The Smart Match modal is the prototype case.
- **Intentionally retired** — the feature was deliberately dropped (e.g. an old vanilla-JS dependency the React stack handles differently). Cite the commit message or the user can confirm.

Each "Missing entirely" row in the report should link the commit that introduced the feature, the commit that deleted it (`28534ec5` in most cases, but check — some may have been deleted earlier), and a one-paragraph "what it did" reconstructed from the file's own comments + tests.

#### Axis 2 — Command coverage

The v1.0.0 builder also held command descriptions in `packages/web/public/builder/js/command-descriptions.js` (488 lines per the deletion commit's stat) and the command list in `commands.js` (1195 lines). Check whether every command the legacy builder exposed is still present and runnable in the React app:

- Diff the command keys from `commands.js@server-v1.0.0` against the current command registry. Surface any commands the React app no longer offers in its step picker — even if the underlying server module still exists.
- For each command the React app still offers, spot-check the field set. The legacy builder used `field-tooltip.js` / `path-var-card.js` / `dsl-rules-builder.js` to render config fields. If a field exists in the legacy schema but not in the React `commandSchemas` for the same command, that's a regression.

#### Axis 3 — Helper utilities a user could observe

`html-escape.js`, `lookup-links.js`, `modal-keys.js`, `path-var-options.js`, `specials-fuzzy.js` (already accounted for by worker 59). For each helper, check whether its **observable behavior** is reproduced somewhere in the React stack. The Sortable / js-yaml vendored libraries can be confirmed as still in use via `yarn.lock` (Sortable is now an npm dep; same for js-yaml).

#### Axis 4 — End-to-end UX flows

Three flows that touched many files in the legacy builder and are good integration tests for the audit:

1. **Sequence load / save flow.** `load-modal.js` (165 lines) + the YAML codec in `js-yaml`. Verify load + save still produces compatible YAML. If the React app's YAML format diverged, document it (and check whether [packages/web/src/jobs/yamlCodec.ts](../../packages/web/src/jobs/yamlCodec.ts)'s `legacyFieldRenames` map covers the drift — see the `yaml-codec-location` memory).
2. **File explorer modal.** `file-explorer-modal.js` (1212 lines) vs. [packages/web/src/components/FileExplorerModal/FileExplorerModal.tsx](../../packages/web/src/components/FileExplorerModal/FileExplorerModal.tsx). Worker 48 already plans a search/filter add-on; this audit might surface other gaps (e.g. the legacy version had clipboard, sort options, breadcrumbs — verify each).
3. **DSL rules builder.** `dsl-rules-builder.js` + its sibling files (~3000 lines total in the legacy tree). High-risk area for missing UI; check the React equivalent thoroughly.

### What to write

One report at `docs/audits/v1.0.0-feature-parity.md` (new dir if not present) with this structure:

```md
# v1.0.0 feature-parity audit

Baseline: `server-v1.0.0` (commit ff92625b, 2026-05-09)
Compared against: `feat/mux-magic-revamp` @ <SHA>
Date: <YYYY-MM-DD>

## Summary
- Ported: N components / M commands
- Partially ported: N
- Missing entirely: N
- Intentionally retired: N

## Missing entirely
(One H3 per item — link the legacy file, link the delete commit, describe what it did, recommend a follow-up worker number.)

## Partially ported
(Same shape; list the gaps inside each item.)

## Intentionally retired
(Cite evidence — commit message, design doc, user statement.)

## Ported (sanity table)
(One-line per item: legacy path → React path. No detail unless surprising.)
```

For each item in the "Missing entirely" and "Partially ported" sections, also create a per-feature follow-up worker doc at `docs/workers/<next-id>_<slug>.md` modeled on worker 59's structure. Slot each into [MANIFEST.md](MANIFEST.md) as `ready` under "Phase 3 — Name Special Features overhaul" if NSF-adjacent, or under the appropriate phase otherwise. Reserve a contiguous block of IDs for the audit's follow-ups so reviewers can see the cluster (e.g. 61–6N).

### What NOT to do

- **Do not** restore any deleted feature in this worker's PR. Each restoration gets its own worker so it has its own test coverage and review.
- **Do not** open feature requests for things that are improvements rather than regressions. The bar for inclusion is: *"this existed in v1.0.0 and a v1.0.0 user could observe its absence today."*
- **Do not** rely on memory or vibes — every item in the report links a specific commit, file path, or test.

---

## TDD steps

This worker has no executable deliverable, so there's nothing to TDD in the strict sense. But the audit should be **reproducible** — a second reviewer running the same `git ls-tree` and `git show` commands should land on the same list. Include the exact commands at the top of the report so the audit is verifiable.

---

## Files

**New:**

- [docs/audits/v1.0.0-feature-parity.md](../audits/v1.0.0-feature-parity.md) — the report.
- One follow-up worker doc per "Missing entirely" / "Partially ported" item under [docs/workers/](../workers/), numbered sequentially from the next free slot.

**Modified:**

- [docs/workers/MANIFEST.md](MANIFEST.md) — add a row per follow-up worker; flip this worker's row to `done` on merge.

---

## Verification checklist

- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Report exists at [docs/audits/v1.0.0-feature-parity.md](../audits/v1.0.0-feature-parity.md)
- [ ] Every "Missing entirely" item links: (a) the legacy file at the v1.0.0 tag, (b) the delete commit, (c) a recommended follow-up worker ID
- [ ] Every "Partially ported" item lists specific gaps with line-number links into the React equivalent
- [ ] Follow-up worker docs created and slotted into MANIFEST as `ready` / `planned`
- [ ] Reproducer commands at the top of the report match what the audit actually ran
- [ ] `yarn lint` clean (markdown formatting)
- [ ] PR opened
- [ ] Manifest row → `done`

## Why this is its own worker

Worker 59 fixes one known regression (Smart Match modal). This worker confirms or rules out the broader hypothesis that more regressions exist from the same `28534ec5` deletion (or earlier sweeps). The user's instinct after finding the Smart Match gap was *"based on what you're saying, I never tested the React version against real files, but I swear I did. Maybe I didn't verify the special features renaming, but I believe I did check that too. Very strange."* The audit either validates or invalidates that doubt with concrete evidence, and produces the follow-up worker queue automatically.
