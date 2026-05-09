# React Migration Checklist

Last updated: 2026-05-09 by Claude Opus 4.7 (PR #1)

## Phase Status

| PR | Description | Status | Branch | Notes |
|----|-------------|--------|--------|-------|
| PR #1 | Bootstrap (monorepo, Vite, Biome) | [x] Done | react-migration | typecheck + biome + eslint all green; manual verify confirmed both servers running cleanly |
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

## Deferred from PR #1 (do these in focused follow-up PRs)

- **npm publish of `@media-tools/shared` v0.1.0**: workflow exists at `.github/workflows/publish-shared.yml` but no tag has been pushed. Re-open before any `media-sync` consumer work begins. Requires `NPM_TOKEN` repo secret.
- **Hono dev proxy to Vite**: in PR #1 the two servers run independently (Hono on :3000, Vite on :5173). Adding a proxy that falls through to Vite for non-API / non-static paths needs careful testing against `serveStatic`'s 404 behaviour — keeping it isolated in its own PR makes the failure mode bisectable.
- **Biome scope expansion + reformat**: `biome check` currently runs only on `packages/web/` and `packages/shared/`. Expanding to the legacy server tree, `scripts/`, and `public/` will produce ~500 formatter changes; do that as a single dedicated reformat-and-include PR so the diff doesn't dilute migration work.
- **ESLint plugin install**: `eslint-plugin-react-compiler`, `eslint-plugin-testing-library`, `import-x/no-barrel-files` are referenced in `eslint.config.js` comments but not yet installed. Land each one alongside the first file it polices (PR #2 brings react-compiler + the first React component, the first `.test.tsx` brings testing-library).
- **Changesets + version workflow**: not part of PR #1; will be added before the first wave merges so version bumps stay automated.
- **CI workflow (`.github/workflows/ci.yml`)**: not part of PR #1; the verification gates here run locally. Land alongside Changesets.

## Open Questions

(none yet)
