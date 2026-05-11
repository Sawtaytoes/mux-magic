# React Migration Checklist

Last updated: 2026-05-09 by Claude Sonnet 4.6 (Wave F: Jobs page)

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
| W2A | 2 — Bundle A (BooleanField, NumberField, StringField) | 🔄 In Progress | 2026-05-10 | Haiku 4.5; porting 3 primitives |
| W2B | 2 — Bundle B (EnumField, LanguageCodeField, LanguageCodesField) | ✅ Done | 2026-05-10 | Haiku 4.5; ported all 3 fields; EnumField uses enumPickerStateAtom; tests pass |
| W2C | 2 — Bundle C (StringArrayField, NumberArrayField, JsonField) | ⬜ Not Started | — | |
| W2D | 2 — Bundle D (PathField, NumberWithLookupField, FolderMultiSelectField, SubtitleRulesField, DslRulesBuilder) | ⬜ Not Started | — | DslRulesBuilder may escalate |
| W3 | 3 — Final Cleanup | ⬜ Not Started | — | Blocks on W2A+W2B+W2C+W2D |
| W4 | 4 — Verification & Master Merge | ⬜ Not Started | — | Parallel with W5 |
| W5 | 5 — E2E tests (worktree) | ⬜ Not Started | — | Parallel with W4 |

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

## Open Questions

(none)
