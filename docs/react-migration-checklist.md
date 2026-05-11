# React Migration Checklist

Last updated: 2026-05-11 by Claude Opus 4.7 (orchestrator handoff to next session — see [orchestrator-handoff.md](orchestrator-handoff.md))

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
| W5A | 5 — Parity-trap + code-smell + a11y cleanup + page stories | ✅ Done | 2026-05-11 | Sonnet high effort. 5 commits: (1) biome.json parse fix, (2) 4 bridge globals wired as Jotai actions in useBuilderActions (pasteCardAt/copyGroupYaml/runGroup/copyStepYaml), types.window.d.ts slimmed 7→3, PageHeader.mdx rewritten, buildBuilderUrl format documented + 5 round-trip tests; (3) code-smell sweep — FieldDispatcher+TodoField extracted from RenderFields, let-mutation fixed in BuilderSequenceList+JobCard, flattenSteps deduplicated into sequenceUtils with O(1) forEach+push; (4) a11y — aria-required+id added to 7 field components, 3 JsonField a11y tests; (5) BuilderPage.stories.tsx (4 stories). Gate: 1024/1024 tests, typecheck clean, 1 pre-existing lint warning. |
| W5B | 5 — Restore missing builder UI controls + drag-and-drop fix + version footer | ✅ Done | 2026-05-11 | claude-sonnet-4-6 high effort. Drag-and-drop: installed sortablejs npm pkg, wired useDragAndDrop in BuilderSequenceList. runOrStopStep ported to atom, StepCard wired. types.window.d.ts shrank to 2 globals (all 5 parity-traps removed). YamlModal story fixed (atom-driven). Storybook mock-server-plugin: 6 new lookup endpoints + /files/default-path. biome.json missing comma fixed. 1023 tests (was 1004). |
| W5C | 5 — Restore command field tooltips (data restoration) | ✅ Done | 2026-05-11 | Sonnet medium. **Hypothesis B confirmed:** descriptions never lived in legacy `commands.js` — they were authored as Zod `.describe()` calls in `packages/server/src/api/schemas.ts` and emitted by `packages/server/scripts/build-command-descriptions.ts` into `public/builder/js/command-descriptions.js` (deleted in W3). Restored ~100 fields verbatim from Zod across 36 commands; hidden-type fields skipped. Wire-up fixes: `CommandField` type gained `description?: string`; `FieldLabel` replaced old `data-tooltip-key` DOM bridge with `FieldTooltip` integration. Regression guard test added. Branch: `feat/restore-tooltips`. |
| W6A | 6 — E2E completion (continues W4B) | ✅ Done | 2026-05-11 | Sonnet medium. 36 e2e tests pass / 5 skipped (2 drag-drop deferred to W6B, 3 video-seek need global FileVideoPlayer mount). 1040 unit tests. Fixed SPA fallback routing in server.ts (per-request index.html read), added aria-labels to StepCard controls, fixed step-actions always-visible at wide viewport, added data-* attrs to DSL components, aria-label to NumberWithLookupField. New: e2e/step-controls.spec.ts (8 tests). |
| W6B | 6 — Replace SortableJS with @dnd-kit (React-native DnD) | ✅ Done | 2026-05-11 | claude-sonnet-4-6 medium. Pattern (a): direct composition. `dragReorderAtom` handles top-level/within-group/cross-container moves + group-in-group guard. `DragOverlay` added. Keyboard a11y via `KeyboardSensor` + `sortableKeyboardCoordinates`. `useDragAndDrop` hook deleted. 1046/1046 tests, typecheck clean, lint 1 pre-existing warning. |
| W7A | 7 — Storybook reorganization + Modal primitive + missing toggle story | ⬜ Not Started | — | Sonnet medium. Prompt: [react-migration-prompts/W7A.md](react-migration-prompts/W7A.md). Runs in **worktree** `.claude/worktrees/w7a` on `feat/storybook-reorg`. Parallel with W7B + W7C (disjoint files). Three streams: (1) extract base Modal primitive; (2) regroup Storybook stories into `Fields/`, `Modals/`, `Pickers/`, `Pages/`, `Components/`; (3) find and add story for the missing toggle/switch element. |
| W7B | 7 — LinkPicker bug fixes (stored format + alignment + step paths + footer) | 🔄 In Progress | 2026-05-11 | Sonnet medium. Prompt: [react-migration-prompts/W7B.md](react-migration-prompts/W7B.md). Runs in **worktree** `.claude/worktrees/w7b` on `fix/link-picker`. **[PARITY]** Four bugs: (1) `selectItem` stores `"path:basePath"` instead of bare `"basePath"` — breaks YAML and selection; (2) dropdown right-aligned, should be center-aligned; (3) step items show no output path detail (hardcoded `detail: ""`); (4) missing "Don't see what you need?" footer hint. Parallel with W7A + W7C. |
| W7C | 7 — Sequence Runner crash (Content-Type mismatch) | ✅ Done | 2026-05-11 | Sonnet medium. Prompt: [react-migration-prompts/W7C.md](react-migration-prompts/W7C.md). Runs in **worktree** `.claude/worktrees/w7c` on `fix/sequence-runner`. **[PARITY]** Client sends `Content-Type: application/yaml` raw text but route only declares `application/json` — `body.steps` is undefined → crash. Fix: three fetch calls wrap YAML in `JSON.stringify({ yaml })` + defensive guard in `sequenceRunner.ts`. Gate: 1058/1058 tests, typecheck clean, lint 1 pre-existing warning. Parallel with W7A + W7B. |
| W7D | 7 — PathField typing behavior + PathPicker wiring | ⬜ Not Started | — | Sonnet medium. Prompt: [react-migration-prompts/W7D.md](react-migration-prompts/W7D.md). **[PARITY]** PathField onChange: when linked to path var, typing should call `setPathValue` (not `setParam`); when "-- custom --", typing should create+link a new path var. PathPicker (directory listing popup) needs wiring to both PathField and PathVarCard text inputs. Depends on W7B (link format fix). Parallel with W7A/W7C (disjoint files). |
| W7E | 7 — SubtitleRulesField default-rules preview section | ⬜ Not Started | — | Sonnet medium. Prompt: [react-migration-prompts/W7E.md](react-migration-prompts/W7E.md). **[PARITY]** When `hasDefaultRules` is checked, the builder should show a read-only collapsible section ABOVE predicates titled "Default rules (run before user rules; readonly):" in amber color, showing the representative default rules (`setScriptInfo ScriptType=v4.00+`, `setScriptInfo YCbCr Matrix=TV.709`, `setStyleFields` with margin values). React port AND master both lost this section; origin unclear (no git blame without full audit). Parallel with W7A/B/C/D (disjoint files — `SubtitleRulesField.tsx` + `DslRulesBuilder.tsx`). |
| W7F | 7 — DnD drop indicator + group droppable zone + DnD tests/stories | ⬜ Not Started | — | Sonnet medium. Prompt: [react-migration-prompts/W7F.md](react-migration-prompts/W7F.md). **[PARITY]** Issues in `BuilderSequenceList` + `GroupCard` + `dragReorderAtom`: (1) no visual drop indicator — add `onDragOver`, track `overId`, highlight "over" item/container; (2) group inner container not droppable when empty — add `useDroppable` + handle `overId = groupId` as append-to-end; (3) `DragOverlay` only handles `StepCard` — dragging a group shows no floating overlay. **Plus test/story coverage:** `BuilderSequenceList` needs a Storybook story (parallel group layout, sequential list, empty state); `GroupCard` stories need parallel layout + collapse states; add unit tests for `dragReorderAtom` (arrow move, cross-container, append-to-empty-group); add e2e drag spec for arrow reorder parity. Parallel with W7A/B/C/D/E. |

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
| W5A | 2026-05-11 | fix(biome): pre-existing parse error in biome.json comma |
| W5A | 2026-05-11 | feat(builder): wire pasteCardAt/copyGroupYaml/runGroup/copyStepYaml as Jotai actions |
| W5A | 2026-05-11 | refactor(components): extract FieldDispatcher/TodoField, fix let mutations, deduplicate flattenSteps |
| W5A | 2026-05-11 | feat(a11y): aria-required + id for 7 field components; JsonField a11y tests |
| W5A | 2026-05-11 | feat(stories): BuilderPage.stories.tsx — Empty/MidEdit/FullPipeline/StepRunning |
| W5A | 2026-05-11 | chore(checklist): W5A ✅ Done — gate: 1024/1024 tests, typecheck clean, 1 pre-existing lint warning |
| W5B | 2026-05-11 | chore(checklist): W5B in progress — drag-and-drop, runOrStopStep port, Storybook polish |
| W5B | 2026-05-11 | fix(builder): restore drag-and-drop — install sortablejs npm pkg, switch DragAndDrop.tsx from window.Sortable to npm import, wire useDragAndDrop in BuilderSequenceList |
| W5B | 2026-05-11 | feat(builder): port runOrStopStep to runOrStopStepAtom; wire StepCard; shrink types.window.d.ts |
| W5B | 2026-05-11 | fix(storybook): YamlModal story sets yamlModalOpenAtom; lookup search mocks in mock-server-plugin |
| W5B | 2026-05-11 | fix(biome): add missing comma in biome.json include array |
| W5C | 2026-05-11 | feat(commands): restore field descriptions from server Zod schemas + wire FieldTooltip (Hypothesis B; all 36 commands, ~100 fields; verbatim from Zod .describe() calls) |
| W5C | 2026-05-11 | test(commands): regression guard — every non-hidden field must have a description |
| W5C | 2026-05-11 | fix(biome): restore missing comma in files.includes array |
| W5C | 2026-05-11 | W5C complete — branch feat/restore-tooltips pushed; awaiting orchestrator merge to react-migration |
| (orchestrator) | 2026-05-11 | Merge feat/restore-tooltips → react-migration after W5B's merge landed |
| W6A | 2026-05-11 | chore(checklist): W6A in progress — worktree e2e-completion created, W4B branch rebased onto react-migration |
| W6A | 2026-05-11 | W6A complete — 36 e2e pass / 5 skipped / 0 fail; 1040 unit tests; branch e2e-completion pushed |
| W6B | 2026-05-11 | chore(checklist): W6B in progress — @dnd-kit migration, pattern (a) direct composition |
| W6B | 2026-05-11 | chore(deps): add @dnd-kit/core + @dnd-kit/sortable + @dnd-kit/utilities; remove sortablejs |
| W6B | 2026-05-11 | refactor(builder): port drag-and-drop from SortableJS to @dnd-kit (StepCard + GroupCard) |
| W6B | 2026-05-11 | chore(checklist): W6B ✅ Done — 1046/1046 tests, typecheck clean, lint 1 pre-existing warning |
| (orchestrator) | 2026-05-11 | Merge e2e-completion (W6A) → react-migration; resolved checklist conflict; 1046 tests passing |
| (orchestrator) | 2026-05-11 | fix(path-field): remove redundant "Linked → stepId.output" div (link button already shows resolved step name) |
| (orchestrator) | 2026-05-11 | fix(predicates): add "name" label + "✕ Remove" text to PredicateCard for parity with legacy |
| (orchestrator) | 2026-05-11 | docs(checklist): update W7B to 4 parity gaps; add W7E (SubtitleRulesField default-rules preview); add W7C/D prompt files |
| (orchestrator) | 2026-05-11 | fix(dsl-rules): human-friendly labels — "Scale border and shadow", "Ignore Style Names" regex wrapper, setScriptInfo side-by-side layout |
| (orchestrator) | 2026-05-11 | fix(groups): add animateLayoutChanges to useSortable; disable run button when no runnable steps; lower parallel breakpoint 640→480px |
| (orchestrator) | 2026-05-11 | fix(loadYaml): allow blank steps (command: '') — treat as placeholder; skip field loading; add loadYaml.test.ts (12 tests) |
| (orchestrator) | 2026-05-11 | docs(checklist): add W7E + W7F prompt files; update checklist rows with prompt links |
| W7C | 2026-05-11 | fix(sequence-runner): send Content-Type application/json (yaml-wrapped) instead of raw YAML text |
| W7C | 2026-05-11 | chore(checklist): W7C ✅ Done — 1058/1058 tests, typecheck clean, lint 1 pre-existing warning |
| W7B | 2026-05-11 | chore(checklist): W7B in progress — 4 LinkPicker parity bugs |
| W7B | 2026-05-11 | fix(link-picker): store bare pathVarId + step object instead of display strings |
| W7B | 2026-05-11 | fix(link-picker): center-align dropdown under trigger (was right-aligned) |

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

## Open Polish Items

These are UX enhancements beyond parity — user-confirmed as "future optimization". Spawn after all [PARITY] workers are done and the branch is stable.

| ID | Area | Description |
|----|------|-------------|
| POLISH-1 | `SetStyleFieldsRule` — field key input | The style field keys (`MarginV`, `MarginL`, `MarginR`, `Fontname`, `Fontsize`, `PrimaryColour`, etc.) are a closed set defined by the ASS spec. Replace the free-text key input in `StyleFieldRow` with a dropdown of known ASS `[V4+ Styles]` column names, with a free-text fallback for unknown keys. Source of truth: `packages/server/src/tools/applyAssRules.ts` (the `setStyleFields` implementation knows which keys are valid). |
| POLISH-2 | `StepCard` — command category tag | Legacy builder showed the command's `tag` (e.g. "File Operations") next to the command name in the card header. React port renders only the command label. Low priority per user ("not a huge deal"). |
