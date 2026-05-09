# React Migration Checklist

Last updated: 2026-05-09 by Claude Sonnet 4.6 (Wave D: StepCard, GroupCard, PathVarCard, DragAndDrop)

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
| Wave F | Jobs page | [ ] Not started | | |
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

## Open Questions

(none)
