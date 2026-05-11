# React Migration Checklist

Last updated: 2026-05-10 by Claude Sonnet 4.6 (W3: Final Cleanup)

## Phase Status

| PR | Description | Status | Branch | Notes |
|----|-------------|--------|--------|-------|
| PR #1 | Bootstrap (monorepo, Vite, Biome) | [x] Done | react-migration | typecheck + biome + eslint all green; manual verify confirmed both servers running cleanly |
| PR #2 | LoadModal — first component | [x] Done | react-migration | atoms + bridge + loadYaml.ts + LoadModal.tsx + tests; js-yaml + testing-library added; legacy load-modal.js deleted; Storybook files created (install deferred) |
| Wave A-1 | YamlModal | [x] Done | react-migration | reads stepsAtom+pathsAtom via yamlSerializer.toYamlStr; copy+backdrop close; tests+stories+MDX |
| Wave A-2 | CommandHelpModal | [x] Done | react-migration | commandHelpModalCommandAtom drives which command shows; field entries with required badge + type badge; tests+stories+MDX |
| Wave A-3 | FieldTooltip | [x] Done | react-migration | wraps label children; portal-rendered tooltip; 200ms hover delay via ref; viewport-clamped position; tests+stories+MDX |
| Wave A-4 | CollapseChevron, CopyIcon, InsertDivider, StatusBadge | [x] Done | react-migration | separate-prop API for InsertDivider (onInsertSequentialGroup/onInsertParallelGroup); tests+stories+MDX for all 4; conflict with parallel worker resolved |
| Wave B-0 | RenderFields (unblocks B) | [ ] Not started | | |
| Wave B | All field types (parallel) | [ ] Not started | | |
| Wave C-0 | Popover primitive (unblocks C) | [x] Done | react-migration | thin Radix @radix-ui/react-popover re-export in primitives/Popover.tsx for Wave D+ |
| Wave C | All pickers (parallel) | [x] Done | react-migration | CommandPicker, EnumPicker, LinkPicker, PathPicker — Jotai atoms + bridge + createPortal; legacy picker JS deleted; tests+stories for all 4 |
| Wave D | StepCard, GroupCard, PathVarCard, DragAndDrop | [x] Done | react-migration | sequenceAtoms.ts (all step/group mutations); StepCard, GroupCard, PathVarCard, useDragAndDrop hook (Sortable.js, animation:0); DoubleChevron icon; RenderFields stub; tests+stories for all; typecheck clean |
| Wave E | PageHeader, LookupModal, RunSequence, etc. | [x] Done | worktree-wave-e | PageHeader, LookupModal, FileExplorerModal, ApiRunModal, PromptModal — all with tests + stories |
| Wave F | Jobs page | [x] Done | react-migration | JobCard + StatusBar + ProgressBar + useSseStream + useLogStream + useTolerantEventSource; JobsPage live; public/jobs/ deleted |
| Final | Delete legacy files, bridge cleanup | [ ] Not started | | |

## Decisions Made

- Yarn 4, React 19, Vite, Jotai, React Router v7 (declarative), TanStack Query v5
- Biome (primary) + ESLint (react-compiler + testing-library + import-x/no-barrel-files only)
- Storybook v10 with MDX docs per component
- Playwright for E2E; Vitest browser for component tests
- No barrel files (except `packages/shared/src/index.ts` — npm package boundary)
- OpenAPI schema auto-generated from running server; not committed to git
- `@media-tools/shared` v0.1.0 publish to npm is **deferred** out of PR #1 (workflow is in place; manual publish later)

## Deferred from PR #1 (do these in focused follow-up PRs)

- **npm publish of `@media-tools/shared` v0.1.0**: workflow exists at `.github/workflows/publish-shared.yml` but no tag has been pushed. Re-open before any `media-sync` consumer work begins. Requires `NPM_TOKEN` repo secret.
- **Hono dev proxy to Vite**: in PR #1 the two servers run independently (Hono on :3000, Vite on :5173). Adding a proxy that falls through to Vite for non-API / non-static paths needs careful testing against `serveStatic`'s 404 behaviour — keeping it isolated in its own PR makes the failure mode bisectable.
- **Biome scope expansion + reformat**: `biome check` currently runs only on `packages/web/` and `packages/shared/`. Expanding to the legacy server tree, `scripts/`, and `public/` will produce ~500 formatter changes; do that as a single dedicated reformat-and-include PR so the diff doesn't dilute migration work.
- **ESLint plugin install**: `eslint-plugin-react-compiler`, `eslint-plugin-testing-library`, `import-x/no-barrel-files` are referenced in `eslint.config.js` comments but not yet installed. Land each one alongside the first file it polices (PR #2 brings react-compiler + the first React component, the first `.test.tsx` brings testing-library).
- **Changesets + version workflow**: not part of PR #1; will be added before the first wave merges so version bumps stay automated.
- **CI workflow (`.github/workflows/ci.yml`)**: not part of PR #1; the verification gates here run locally. Land alongside Changesets.

## Deferred from PR #2

- ~~**Storybook v10 install**~~: Done (79929fc). `@storybook/react-vite`, `addon-docs`, `addon-a11y`, `addon-themes`, `addon-vitest`, `msw-storybook-addon` installed; `yarn workspace @media-tools/web storybook` runs at :6006 with LoadModal story visible.
- **Hono dev proxy** (carried from PR #1): The Vite bundle is injected into `public/builder/index.html` via a hardcoded `http://localhost:5173/src/app.tsx` dev script tag. This works in dev but needs the Hono proxy for a clean production path. Remove the script tag from the legacy HTML when the proxy lands.
- **ESLint plugin install** (carried from PR #1): `eslint-plugin-react-compiler`, `eslint-plugin-testing-library`, `eslint-plugin-import-x` are referenced in `eslint.config.js` but not installed. Install in a dedicated PR before CI is enabled.

## Post-Migration: Rename to MuxMagic

After the Final PR is merged and the user confirms migration complete, the project will be renamed from `media-tools` → **MuxMagic**. This includes npm scope (`@media-tools/*` → `@muxmagic/*`), repo/directory rename, Docker image tag, and republishing `@media-tools/shared` under `@muxmagic/shared`.

**Do not pre-emptively rename anything during migration phases.** All workers use `@media-tools/*` until the dedicated rename pass. The local directory and repo rename requires manual coordination by the user (CI config, nginx-proxy-manager, `media-sync` references).

See `docs/react-migration-plan.md` § "Post-Migration: Rename to MuxMagic" for the full scope table.

## Follow-up Refactors

- **Unify CSS colors to variables** — `builderStyles.css` has bare hardcoded colors (`#34d399`, `#6ee7b7`, `#fbbf24`, `rgb(15 23 42)`, `rgb(51 65 85)`, etc.). Extract to CSS custom properties (`:root { --color-emerald: #34d399; ... }`) so changing a color in one place affects all uses. Tailwind v4 generates a CSS variable for each utility color; reuse those definitions. Do this as a standalone refactor PR after PR #2 is merged.

---

## React Migration Recovery — Phase 0

**Worker handout (canonical plan):** [react-migration-recovery-handout.md](react-migration-recovery-handout.md)

Future workers spawned in separate Claude sessions: read the handout above, find your Worker ID, and execute your section. This checklist tracks who has finished what.

### Worker Status

| Worker | Phase | Status | Date | Notes |
|---|---|---|---|---|
| Pre-W0 | — AGENTS.md no-snapshot/no-VRT | ✅ Done | 2026-05-10 | Commit 3f8bf84 (orchestrator) |
| (infra) | — Exclude storybook-static from lint+typecheck | ✅ Done | 2026-05-10 | Commit 1e7cf03 (orchestrator) — unblocks pre-push gate |
| W0a | 0 — Stale cleanup + plan copy | ✅ Done | 2026-05-10 | Orchestrator took over after subagent permission failure. 7 worktree dirs deleted, 2 stale branches deleted (both already-merged work), plan copied from ~/.claude/plans → docs/react-migration-recovery-handout.md |
| W0b | 0 — Audit existing state | ✅ Done | 2026-05-10 | claude-sonnet-4-6, low effort, subagent run successful — commit b882c23 |
| W0c | 0 — Parity reference capture | ✅ Done | 2026-05-10 | claude-sonnet-4-6 — 36 fixture pairs captured via Node script (buildParams inline); commit 51da90d |
| W1 | 1 — Wave B-0 RenderFields | ✅ Done | 2026-05-10 | claude-sonnet-4-6; 8 commits; COMMANDS+buildParams+links+fieldVisibility ported, RenderFields dispatcher live, BuilderPage+yamlSerializer migrated, fixtures frozen |
| W2A | 2 — Bundle A (BooleanField, NumberField, StringField) | ✅ Done | 2026-05-10 | Haiku 4.5; all 3 primitives ported, dispatcher wired, tests pass |
| W2B | 2 — Bundle B (EnumField, LanguageCodeField, LanguageCodesField) | ✅ Done | 2026-05-10 | Haiku 4.5; ported all 3 fields; EnumField uses enumPickerStateAtom; tests pass |
| W2C | 2 — Bundle C (StringArrayField, NumberArrayField, JsonField) | ✅ Done | 2026-05-10 | Haiku 4.5; all 3 array/json fields ported with parity tests; dispatcher wired; tests pass |
| W2D | 2 — Bundle D (PathField, NumberWithLookupField, FolderMultiSelectField, SubtitleRulesField, DslRulesBuilder) | ✅ Done | 2026-05-10 | Haiku 4.5; 4 fields ported + wired to RenderFields; DslRulesBuilder escalated to Phase 2.5 (non-mechanical port); commit a98ae9b |
| W2.5 | 2.5 — DslRulesBuilder (escalated from W2D) | ✅ Done | 2026-05-10 | claude-sonnet-4-6, high effort. Prompt: [react-migration-prompts/W2-5.md](react-migration-prompts/W2-5.md). 5 commits: types, utils, 18 component files, wire SubtitleRulesField, mutation tests + stories. 281 tests passing. |
| W3 | 3 — Final Cleanup | ✅ Done | 2026-05-10 | claude-sonnet-4-6 (high effort). 3 prod source files migrated to atoms; 19 test/story/MDX files cleaned; public/builder/ + public/vendor/ deleted; 10 loose legacy public assets deleted; types.window.d.ts slimmed to 7 remaining bridge globals; 1004 tests pass, typecheck clean. |
| W4A | 4 — Verification & Master Merge | 🟡 Audit done; master merge reverted | 2026-05-10 | claude-sonnet-4-6 medium. All 4 gates passed (1004 tests, typecheck, lint, build). 36 YAML fixtures: zero diff. Checklist audited — all rows verified. types.window.d.ts: 7 globals annotated (2 implemented, 5 W5 parity-traps). Storybook: 118 stories. **Master merge (22b48b0) + tag `react-migration-complete` were force-rewound by orchestrator at user's request — user wants to manually verify the migration end-to-end before master is updated.** W4A's audit work and capture-script update remain on react-migration; re-merge to master happens after user verification + W4B + W5. |
| W4B | 4 — E2E tests (worktree off post-W3 react-migration) | 🟡 Specs authored; ready to rebase | 2026-05-10 | claude-sonnet-4-6 medium. 4 spec files authored (jobs, modals, drag-drop, dsl-rules). `yarn e2e` was blocked by playwright config baseURL mismatch (pointed at API server, but React SPA is on web server post-W3) — orchestrator fixed config (use.baseURL → webBaseURL) and deleted dead legacy e2e/builder.spec.ts (12 refs to pre-React DOM globals). W4B can now rebase onto react-migration HEAD and run their full gate; merge to master deferred until user finishes manual verification. |
| W5A | 5 — Parity-trap + code-smell + a11y cleanup + page stories | 🔄 In Progress | 2026-05-11 | Sonnet high effort. Prompt: [react-migration-prompts/W5A.md](react-migration-prompts/W5A.md). Runs on **main checkout** on `react-migration`. Parallel with W5B + W5C. 4 streams: parity quirks (JsonField + 4 bridge atoms + MDX prose), code-smell sweep, a11y pass, page-level Storybook stories. Plus buildBuilderUrl format audit. (Was W5/W6 in earlier docs.) |
| W5B | 5 — Restore missing builder UI controls + drag-and-drop fix + version footer | 🔄 In Progress | 2026-05-11 | Sonnet **high effort**. Prompt: [react-migration-prompts/W5B.md](react-migration-prompts/W5B.md). Runs in **worktree** `.claude/worktrees/w5b` on `feat/restore-builder-controls`. Parallel with W5A + W5C. Regression fixes user found during verification: drag-and-drop broken, up/down arrows missing, X delete button missing, play button missing (`runOrStopStep` port), version footer missing (git-hash stamping). Plus Storybook polish (YamlModal/PathVarCard/DvdCompare investigations). Owns the `runOrStopStep` bridge atom (W5A owns the other 4). |
| W5C | 5 — Restore command field tooltips (data restoration) | ⬜ Not Started | — | Sonnet medium. Prompt: [react-migration-prompts/W5C.md](react-migration-prompts/W5C.md). Runs in **worktree** `.claude/worktrees/w5c` on `feat/restore-tooltips`. Parallel with W5A + W5B (data-only work; touches `packages/web/src/commands/commands.ts`, no file overlap). Restores per-field `description` data that drives FieldTooltip hover content. Investigate legacy `commands.js` first (likely source) before re-authoring. Adds a regression-guard test asserting every field has a non-empty description. |
| W6 | 6 — E2E completion (continues W4B; sequential after W5B) | ⬜ Not Started | — | Sonnet medium. Prompt: [react-migration-prompts/W6.md](react-migration-prompts/W6.md). Runs in **worktree** `.claude/worktrees/w6` on `e2e-completion` (extends W4B's `e2e-tests`). **Spawn after W5B substantially ships UI controls** — adding e2e for a control that doesn't exist is wasted work. Rebases W4B's branch, triages broken specs, adds new specs for restored controls. (Was W5C before naming-convention fix — sequential next-phase = new number, not a letter suffix.) |

### Phase 0 Audit Findings (W0b)

**W0b steps completed:**
- [x] Step 1: Dev environment runs cleanly
- [x] Step 2: Inspect partial component dirs — findings below
- [x] Step 3: Findings committed to checklist

**Dev environment:**
- `yarn install` completed with only peer-dependency warnings (no errors): TypeScript 6 vs ^5 peer req from openapi-typescript; `@babel/core` and `rolldown` not provided by web workspace — these are pre-existing warnings, not new failures.
- `yarn dev` started cleanly at port 5173 in 461 ms; no compile errors.
- `GET http://localhost:5173/` → 200; SPA shell served correctly (no legacy `<script>` tags in root HTML).
- `GET http://localhost:5173/builder` → 200; same SPA shell (React Router handles the route).
- Playwright browser tool was not available (permission not granted); browser console errors not directly observable. No TypeScript/Vite build errors were emitted to stdout.

**Component directory classifications:**

- `EnumField/` — **partial**: `EnumField.tsx` has a real React implementation (renders a trigger button that calls `window.enumPicker?.open(…)`). No test file, no stories file. NOT imported by `RenderFields.tsx` — the dispatcher is still the Wave B placeholder.
- `LanguageCodeField/` — **partial**: `LanguageCodeField.tsx` has a real React implementation (text input, calls `window.setParam?.(…)` on input). No test file, no stories file. NOT imported by `RenderFields.tsx`.
- `PathField/` — **absent**: directory does not exist on disk. W2D must create it from scratch.
- `NumberField/` — **partial**: `NumberField.tsx` has a real React implementation (number input, companionNameField support, calls `window.setParam?.(…)` and `window.scheduleReverseLookup?.(…)`). `NumberField.test.tsx` exists with 4 explicit inline-assertion tests. No stories file. NOT imported by `RenderFields.tsx`.

**Drift detected vs old checklist:**

- `RenderFields.tsx` is still the Wave B placeholder (`// Wave B placeholder — replace with full field rendering when Wave B lands.`). Old checklist marks Wave B-0 as `[ ] Not started` — accurate.
- `EnumField/`, `LanguageCodeField/`, `NumberField/` exist with partial real implementations, but Wave B is listed as Not Started. These were created in a prior undocumented pass but never wired into the dispatcher.
- `FieldLabel/` is fully implemented (`FieldLabel.tsx`, `FieldLabel.test.tsx`, `FieldLabel.stories.tsx`, `FieldLabel.mdx`) — a pre-condition W1 is supposed to create already exists. W1's Step 4 can be skipped or verified rather than rebuilt.
- `PathField/` is completely missing (no directory) despite being listed in Wave B scope; W2D must create from scratch.
- Wave E is marked Done on branch `worktree-wave-e` but those commits are not visible in `origin/react-migration` log. Possible rebase/merge issue — verify before W3.

**Pre-push gate result (W0b, run 2026-05-10):**
- `yarn test run` — ✅ 111 files passed, 28 skipped, 847 tests
- `yarn typecheck` — ✅ clean
- `yarn lint` — ✅ clean (474 files, no fixes applied)

### W0c — Parity Reference Capture

- [x] Step 1: Node script approach used — buildParams is pure, no dev server needed
- [x] Step 2: YAML + input.json captured for all 36 commands in commands.js
- [x] Step 3: Fixture count recorded below

**Fixtures captured (W0c):** `36` command fixtures in `packages/web/tests/fixtures/parity/`
Capture script: `packages/web/scripts/capture-parity-fixtures.ts`
W4 note: swap `COMMANDS` import from `../public/builder/js/commands.js` → `../src/commands/commands.ts` after W1 lands.

### Progress Log

| Worker | Date | Action |
| --- | --- | --- |
| W0b | 2026-05-10 | docs(checklist): record W0b audit findings — partial component dir classification |
| W0c | 2026-05-10 | test: capture parity reference YAML for all commands (Phase 0 baseline) |
| W1 | 2026-05-10 | feat(commands): port COMMANDS to TS |
| W1 | 2026-05-10 | feat(commands): port buildParams to TS with inline-assertion tests |
| W1 | 2026-05-10 | feat(commands): port getLinkedValue and fieldVisibility shared helpers |
| W1 | 2026-05-10 | chore(components): verify existing FieldLabel meets dispatcher needs (FieldLabel.tsx already complete per W0b audit — skip recreation) |
| W1 | 2026-05-10 | feat(components): real RenderFields dispatcher with TodoField placeholders |
| W1 | 2026-05-10 | refactor(builder): hydrate commandsAtom from TS commands module |
| W1 | 2026-05-10 | refactor(jobs): yamlSerializer uses TS buildParams; drop window.mediaTools branch |
| W1 | 2026-05-10 | test(commands): freeze `__fixtures__`/commands.ts for Phase 2 workers |
| W2A | 2026-05-10 | feat(fields): port BooleanField from vanilla JS to React |
| W2A | 2026-05-10 | feat(fields): port NumberField from vanilla JS to React (dropped scheduleReverseLookup; added stories) |
| W2A | 2026-05-10 | feat(fields): port StringField + add string case to RenderFields dispatcher (all three W2A fields wired) |
| W2B | 2026-05-10 | feat(fields): port EnumField + LanguageCodeField + LanguageCodesField (all three fields + stories wired) |
| W2C | 2026-05-10 | feat(fields): port StringArrayField, NumberArrayField, JsonField (parity with legacy behavior; JSON fallback on parse failure) |
| W2C | 2026-05-10 | feat(fields): wire StringArrayField, NumberArrayField, JsonField to RenderFields dispatcher (all W2C fields complete) |
| W2D | 2026-05-10 | chore(checklist): W2D in progress |
| W2D | 2026-05-10 | feat(commands): add lookupLinks.ts (LOOKUP_LINKS constant for NumberWithLookupField) |
| W2D | 2026-05-10 | feat(fields): port PathField + NumberWithLookupField + FolderMultiSelectField + SubtitleRulesField (all with tests + stories; wire to RenderFields dispatcher) |
| W2D | 2026-05-10 | docs(checklist): DslRulesBuilder escalated to Phase 2.5 (non-mechanical port; see escalation section below) |
| W2.5 | 2026-05-10 | feat(dslrules): types — discriminated unions for rule shapes (8 state decisions) |
| W2.5 | 2026-05-10 | feat(dslrules): port clauseUtils, generateFreshKey, ruleMutations, conditionMutations, styleMutations, computeMutations |
| W2.5 | 2026-05-10 | feat(dslrules): port DslRulesBuilder + rule row sub-components (one component per file) |
| W2.5 | 2026-05-10 | feat(dslrules): replace SubtitleRulesField JSON textarea with visual DslRulesBuilder |
| W2.5 | 2026-05-10 | test(dslrules): add mutation unit tests, render tests, and Storybook stories |
| W3 | 2026-05-10 | chore(checklist): W3 in progress |
| W3 | 2026-05-10 | feat(atoms): add setPathValueAtom + setStepRunStatusAtom to sequenceAtoms.ts |
| W3 | 2026-05-10 | refactor(CommandHelpModal): replace window.mediaTools?.COMMANDS with commandsAtom |
| W3 | 2026-05-10 | refactor(PathPicker): replace window.setParam + window.mediaTools.setPathValue with atoms |
| W3 | 2026-05-10 | refactor(ApiRunModal): replace 12 window.mediaTools calls with setStepRunStatusAtom |
| W3 | 2026-05-10 | chore(tests+stories): remove unused window.mediaTools mocks (17 files + 7 MDX docs) |
| W3 | 2026-05-10 | chore(legacy): delete public/builder/ and public/vendor/ (85 files, 51 709 deletions) |
| W3 | 2026-05-10 | chore(legacy): delete 10 loose legacy assets in public/ (1 230 deletions) |
| W3 | 2026-05-10 | chore(legacy): slim types.window.d.ts — drop mediaTools interface, keep 7 remaining bridge globals |
| W4A | 2026-05-10 | chore(checklist): W4A in progress |
| W4A | 2026-05-10 | chore(scripts): update capture-parity-fixtures to import TS COMMANDS |
| W4A | 2026-05-10 | docs(types): annotate types.window.d.ts bridge globals with W5 parity-trap status |
| W4A | 2026-05-10 | chore(checklist): W4A complete — checklist audited; all rows verified against code; merged to master; W4B can rebase |
| W4A | 2026-05-10 | Merge react-migration → master (22b48b00) + tag react-migration-complete. **W4B: master is ready — rebase e2e-tests onto master and merge when specs pass.** |
| W5A | 2026-05-11 | chore(checklist): W5A in progress — 4 streams: parity (4 bridge atoms + MDX + buildBuilderUrl), code-smell, a11y, BuilderPage story |
| W5B | 2026-05-11 | chore(checklist): W5B in progress — drag-and-drop, runOrStopStep port, Storybook polish |
| W5B | 2026-05-11 | fix(builder): restore drag-and-drop — install sortablejs npm pkg, switch DragAndDrop.tsx from window.Sortable to npm import, wire useDragAndDrop in BuilderSequenceList |
| W5B | 2026-05-11 | feat(builder): port runOrStopStep to runOrStopStepAtom; wire StepCard; shrink types.window.d.ts |
| W5B | 2026-05-11 | fix(storybook): YamlModal story sets yamlModalOpenAtom; lookup search mocks in mock-server-plugin |
| W5B | 2026-05-11 | fix(biome): add missing comma in biome.json include array |

## W4A Audit Findings (2026-05-10)

**Pre-merge gate:** ✅ 1004 tests / 137 files pass, typecheck clean, lint 1 pre-existing warning (NumberWithLookupField `as any`), build clean (183 modules, 525 KB).

**Parity matrix:** ✅ All 36 YAML fixtures round-trip with zero diff after swapping capture script import to TS COMMANDS. 8 `.input.json` files show cosmetic JSON whitespace reformat only (compact → expanded arrays); same data.

**Storybook smoke:** ✅ 118 stories registered across 41 story groups. All 13 Wave B field components + DslRulesBuilder present. Key story iframes return HTTP 200.

**Checklist audit — no drift found:**

- All component directories verified to exist with `.tsx` + `.test.tsx` + `.stories.tsx` files
- `packages/web/public/` directory is entirely absent (W3 deletion confirmed)
- `packages/web/index.html` is clean React entry (no legacy `<script>` tags)
- `window.mediaTools` references: prose-only in `PageHeader.mdx` (archival documentation, not code)
- Spot-tested: BooleanField (5 tests ✅), EnumField (4 ✅), DslRulesBuilder (17 ✅), LoadModal (12 ✅), PathField (5 ✅), buildParams (12 ✅)

**`types.window.d.ts` final state:** File retained with 7 globals annotated.

- `getCommandFieldDescription` — registered by `packages/server/scripts/build-command-descriptions.ts` at build time ✅
- `openVideoModal` — registered by `FileExplorerModal` on mount; consumed by `PromptModal` ✅
- `pasteCardAt`, `copyGroupYaml`, `runGroup`, `runOrStopStep`, `copyStepYaml` — **W5 parity-traps**: callers exist in GroupCard/StepCard/BuilderSequenceList but implementations were in deleted legacy `sequence-editor.js`. All use `?.` so UI degrades gracefully (buttons are no-ops). W5 must port these 5 to Jotai atoms + API calls.

## DslRulesBuilder Escalation (W2D)

**Status:** ✅ **Completed in Phase 2.5** (2026-05-10)

**Reason:** Non-mechanical port. After reading all sub-files (`dsl-rules-builder/constants.js`, `state.js`, `render.js`, `rule-crud.js`), the port requires:
- Converting module-level `Set` (`openDetailsKeys`) to Jotai atom
- Full inversion of bridge pattern (`window.mediaTools` read/write → atom subscriptions)
- 8 distinct state shape decisions (rules union type, predicates map, when/applyIf discriminated unions, computeFrom ops chain, fields map, scaleResolution struct, openDetailsKeys)
- Converting string-interpolated onclick handlers to React closures throughout (~10 mutation functions)
- Handling two commit modes (debounced URL sync vs. immediate re-render)

**Recommendation:** Reassign to Sonnet High effort as Phase 2.5 after W2D other fields ship.

**Interim:** SubtitleRulesField ships with JSON textarea fallback. User can edit rules as JSON directly; visual builder deferred.

## Related Initiative — Boolean Naming Rename

Separate from the React migration recovery, but tracked here for visibility. Enforces AGENTS.md rule #4 ("booleans start with `is`/`has`") via `@typescript-eslint/naming-convention` (rule already enabled in commit `cff5a2d` on the `feat/boolean-is-has-naming` branch). Initiative docs at [boolean-rename-prompts/](boolean-rename-prompts/README.md).

| Worker | Scope | Status | Date | Notes |
|---|---|---|---|---|
| WBN-A | `packages/server/**` boolean renames | ✅ Done | 2026-05-10 | Sonnet; 33 files renamed (+174/-156). Commits 7ce722d (rule expansion to cover params + properties) + f0f0dd5 (rename sweep). Lesson saved as memory `feedback_rename_strategy.md`: ESLint naming-convention fires on declarations not references — use `Edit` with `replace_all: true` scoped per file for local renames. |
| WBN-B | `packages/web/**` + `packages/shared/**` boolean renames | ⬜ Not Started (deferred) | — | Sonnet medium. **Wait for react-migration to merge to master before spawning** — running now would conflict with W2A–W2D and W3. Prompt deferred; will be generated after W4. WBN-B's prompt bakes in WBN-A's rename-strategy lesson. |

## Open Questions

(none)
