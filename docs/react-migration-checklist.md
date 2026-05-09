# React Migration Checklist

Last updated: 2026-05-09 by Claude Opus 4.7 (PR #1)

## Phase Status

| PR | Description | Status | Branch | Notes |
|----|-------------|--------|--------|-------|
| PR #1 | Bootstrap (monorepo, Vite, Biome, Storybook) | [~] In progress | react-migration | scaffolding only; legacy JS still drives the app |
| PR #2 | LoadModal — first component | [ ] Not started | | |
| Wave A-1 | YamlModal | [ ] Not started | | |
| Wave A-2 | CommandHelpModal | [ ] Not started | | |
| Wave A-3 | FieldTooltip | [ ] Not started | | |
| Wave A-4 | CollapseChevron, CopyIcon, InsertDivider, StatusBadge | [ ] Not started | | |
| Wave B-0 | RenderFields (unblocks B) | [ ] Not started | | |
| Wave B | All field types (parallel) | [ ] Not started | | |
| Wave C-0 | Popover primitive (unblocks C) | [ ] Not started | | |
| Wave C | All pickers (parallel) | [ ] Not started | | |
| Wave D | StepCard, GroupCard, PathVarCard, DragAndDrop | [ ] Not started | | |
| Wave E | PageHeader, LookupModal, RunSequence, etc. | [ ] Not started | | |
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

## Open Questions / Blockers

- npm publish of `@media-tools/shared` v0.1.0: deferred. Re-open before any `media-sync` consumer work begins.
- Changesets + GitHub `version` workflow: not part of PR #1 scope; will be set up in a follow-up PR before the first wave merges to keep version bumps automated.
- CI workflow (`.github/workflows/ci.yml`): not part of PR #1 scope; will be added in a follow-up PR alongside Changesets.
