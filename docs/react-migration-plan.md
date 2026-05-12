# React 19 + Vite Migration Plan for media-tools

## Purpose

This document is the authoritative plan for migrating the media-tools frontend to React 19.
**It is written for a future AI assistant (likely Claude Sonnet) that will execute the work.**
Follow it precisely, phase by phase. Each phase is independently verifiable.
Multiple AI workers can execute Wave phases in parallel on separate worktrees.

Do not improvise architecture. Do not add libraries not listed here. When in doubt, ask the user.

---

## Context

The media-tools project currently serves a 77-file plain-JavaScript frontend (in `public/builder/` and `public/jobs/`) via a Hono API server. There is no bundler for the frontend — files are served raw as ES modules. State is managed via `window.mediaTools` globals and module-level variables. Tests run in real Chromium via `@vitest/browser`.

This migration adds:
- **React 19** with React Compiler (auto-memoization)
- **Vite** for bundling, HMR, and dev server
- **Jotai** for state management
- **React Router v7** for client-side routing
- **TanStack Query v5** for data fetching
- **Biome** for formatting + linting (primary)
- **ESLint** (minimal, two plugins only)
- **Storybook v10** for component documentation
- **Yarn 4 workspaces** (monorepo)
- **`@media-tools/shared`** — a new npm-published package for utilities shared with media-sync

The migration is **iterative**: the app keeps working at every step.
Legacy JS files are deleted only after the equivalent React component is fully working and tested.

---

## Docs & CHECKLIST Strategy

> **For the executing AI**: Before starting any work, do the following doc housekeeping.

### Archive Old Documentation

Move stale docs to `docs/archive/` so they don't confuse you or other workers:

```
docs/
├── archive/                          # moved here; do not read unless debugging old features
│   ├── builder-refactor-followups.md
│   ├── file-explorer-phase-b.md
│   ├── sse-last-event-id-resume.md
│   ├── mse-transcode-player.md
│   └── options/                      # all files in options/
├── dsl/                              # keep — DSL rules are still active
├── diagnostics/                      # keep — Docker runbook is still relevant
├── orchestration/                    # keep — orchestration README is still relevant
├── sequence-examples.md              # keep — useful for testing
├── CHECKLIST.md                      # replace with react-migration-checklist.md (see below)
└── react-migration-checklist.md      # NEW — AI workers update this as they complete tasks
```

### CHECKLIST.md

The current `docs/CHECKLIST.md` was last updated 2026-05-08 and tracks two open bugs:
1. `nameSpecialFeatures` per-file matcher hang (commits `5075391`, `de18d83` are diagnostic state)
2. Post-rename "Files not renamed" summary card flow

**Action**: Archive it to `docs/archive/CHECKLIST-2026-05-08.md`. Create a new `docs/react-migration-checklist.md` (template below). AI workers must update this checklist as they complete each PR.

### Plan Document Location

Save this plan as `docs/react-migration-plan.md` in the repo. This is the canonical reference for all workers.

---

## Worktree Strategy

**All React migration work happens on the `react-migration` branch, not `master`.**

```bash
# Initial setup (done once by orchestrator)
git worktree add ../media-tools-react-migration react-migration
```

Each AI worker gets their own worktree derived from `react-migration`:

```bash
# Per worker (replace WORKER_NAME)
git worktree add ../media-tools-react-WORKER_NAME react-migration
```

Rules:
- Workers commit and push to `react-migration` (or a sub-branch if conflicts are likely)
- Do NOT merge to `master` until the user explicitly confirms the migration is ready
- Each PR targets `react-migration`, not `master`
- The existing `master` branch stays unmodified and deployable throughout

---

## Architecture

### Monorepo (Yarn 4 Workspaces)

> Yarn version is **4.14.1** (see `packageManager` field in `package.json`). Do not downgrade or change the version.

```
media-tools/
├── package.json                       # root; workspaces: ["packages/*"]
├── tsconfig.base.json                 # shared base TS config
├── biome.json                         # formatter + linter (root, covers all packages)
├── eslint.config.js                   # minimal: react-compiler + testing-library only
├── vitest.config.ts                   # root: references both server + web projects
├── playwright.config.ts               # unchanged
│
├── .github/
│   └── workflows/
│       ├── deploy.yml                 # existing: Docker build + push to ghcr.io
│       └── publish-shared.yml         # NEW: publish @media-tools/shared to npm on tag
│
├── .storybook/
│   ├── main.ts                        # @storybook/react-vite, v10
│   └── preview.ts                     # Jotai Provider, MSW, Tailwind theme
│
├── e2e/                               # Playwright specs (unchanged)
│   ├── builder.spec.ts
│   └── video-seek.spec.ts
│
├── public/                            # LEGACY — deleted incrementally; gone by Final PR
│   └── builder/js/...                 # 77 files being replaced
│
└── packages/
    │
    ├── server/                        # existing server code, moved here
    │   ├── package.json               # name: "@media-tools/server"
    │   ├── tsconfig.json              # NodeNext, no jsx, extends ../../tsconfig.base.json
    │   └── src/
    │       ├── api/
    │       ├── cli/
    │       ├── tools/
    │       ├── app-commands/
    │       ├── cli-commands/
    │       ├── cli-spawn-operations/
    │       ├── shared/                # server-internal types/utils shared by api/ AND cli/
    │       │                          # (renamed from current src/__shared__/ — drop the underscores)
    │       │                          # NOT published to npm; use packages/shared/ for that
    │       └── server.ts
    │
    ├── web/                           # Vite frontend
    │   ├── package.json               # name: "@media-tools/web"
    │   ├── tsconfig.json              # ESNext, bundler, jsx: react-jsx
    │   ├── vite.config.ts
    │   ├── vitest.config.ts           # browser project only
    │   ├── index.html                 # single HTML entry; React Router handles /builder
    │   ├── public/
    │   │   └── mockServiceWorker.js   # generated by `msw init`
    │   └── src/
    │       ├── app.tsx                # Vite entry: boots Jotai + MSW + mounts router
    │       ├── router.tsx             # React Router v7 route definitions
    │       ├── pages/                 # one file per route; thin wrappers only
    │       │   ├── BuilderPage.tsx    # route component for /builder
    │       │   └── JobsPage.tsx       # route component for /
    │       ├── components/            # flat shared component library; all builder + jobs components
    │       │   ├── LoadModal.tsx      # one file per component
    │       │   ├── LoadModal.test.tsx
    │       │   ├── LoadModal.stories.tsx
    │       │   ├── LoadModal.mdx
    │       │   ├── StepCard.tsx
    │       │   ├── JobCard.tsx
    │       │   ├── BooleanField.tsx
    │       │   ├── CommandPicker.tsx
    │       │   ├── Popover.tsx        # Radix-based primitives live here too
    │       │   └── ...               # (all 77 legacy files end up here)
    │       ├── icons/                 # inline SVGs as React components
    │       │   ├── CollapseChevron.tsx
    │       │   ├── CopyIcon.tsx
    │       │   └── ...
    │       ├── state/                 # Jotai atoms; one file per atom or atom group
    │       │   ├── stepsAtom.ts
    │       │   ├── pathsAtom.ts
    │       │   ├── historyAtoms.ts
    │       │   ├── uiAtoms.ts         # modal open states, selected step, etc.
    │       │   ├── flattenedStepsAtom.ts
    │       │   ├── commandsAtom.ts
    │       │   └── bridge.ts          # TRANSITIONAL: window.mediaTools ↔ Jotai
    │       ├── mocks/
    │       │   ├── browser.ts         # MSW worker setup
    │       │   └── handlers.ts        # HTTP mock handlers
    │       ├── api/
    │       │   ├── client.ts          # openapi-fetch client
    │       │   └── schema.generated.ts  # generated; NOT committed to git
    │       └── styles/
    │           ├── tailwindStyles.css  # @import "tailwindcss"; — Tailwind v4 entry
    │           └── builderStyles.css   # existing 325-line custom CSS (unchanged, moved)
    │
    └── shared/                        # publishable npm package
        ├── package.json               # name: "@media-tools/shared"; public; version-tagged
        ├── tsconfig.json
        └── src/
            ├── index.ts               # ONLY barrel file in the project; re-exports all public APIs
            ├── logMessage.ts          # copied from server/src/tools/logMessage.ts
            ├── naturalSort.ts
            ├── createRenameFileOrFolder.ts
            ├── captureLogMessage.ts
            ├── catchNamedError.ts
            ├── rethrowNamedError.ts
            ├── makeDirectory.ts
            ├── aclSafeCopyFile.ts
            ├── readFiles.ts
            ├── readFilesAtDepth.ts
            └── readFolders.ts
            # Zod schemas: if added, one file per entity (e.g., jobSchema.ts, sequenceSchema.ts)
            # Do NOT put all schemas in a single schemas.ts file
```

### Function Style

**Always use `const` + arrow functions (`=>`). Never use `function` declarations unless `this` binding is explicitly required** (it almost never is in React code — hooks, event handlers, and utilities all close over the outer scope).

```ts
// WRONG
function loadYaml(text: string) {
  return parse(text)
}

// RIGHT
const loadYaml = (text: string) => parse(text)
```

**Prefer implicit returns** (expression body, no `{}`). Write functions as single expressions that return a new value. If a function needs `{}` and an explicit `return`, consider splitting it into smaller functions.

```ts
// Implicit return (preferred)
const flattenSteps = (steps: Step[]) =>
  steps.flatMap((step) =>
    isGroup(step)
      ? step.children
      : [step]
  )

// Use explicit return when async/await is needed in production code
const fetchJobs = async () => {
  const res = await client.GET("/jobs")
  return res.data
}

// In tests, async/await with explicit return is always fine — tests are sequential by design
it("loads jobs", async () => {
  const result = await fetchJobs()
  expect(result).toHaveLength(3)
})
```

### Naming: No Single-Letter Variables

**Every variable, parameter, and binding must have a descriptive name.** Single-letter names are banned except in well-understood mathematical contexts (none apply here).

```ts
// WRONG
const flattenSteps = (s: Step[]) => s.flatMap((x) => x.children ?? [x])
client.GET("/jobs").then(r => r.data)
steps.filter(s => s.enabled)

// RIGHT
const flattenSteps = (steps: Step[]) =>
  steps.flatMap((step) => step.children ?? [step])
client.GET("/jobs").then((response) => response.data)
steps.filter((step) => step.enabled)
```

This applies everywhere: arrow function parameters, destructuring aliases, catch clauses, loop variables, map/filter/reduce callbacks.

These conventions apply to all code in the project: server, web, shared.
**Add this to `AGENTS.md` before starting PR #1** (see "PR #1 tasks" below).

---

### No Barrel Files

**Rule**: No `index.ts` or `index.css` files inside component folders. Import components by their full path.

```ts
// WRONG
import { LoadModal } from "./components"

// RIGHT
import { LoadModal } from "./components/LoadModal"
```

The only acceptable root-level export file is at the package root (`packages/shared/src/index.ts`),
which re-exports the public API of the shared package for npm consumers.

ESLint rule to enforce this: `import-x/no-barrel-files` (add to `eslint.config.js`).

---

## Routing: React Router v7 (Declarative Mode)

React Router v7 was previously called Remix. **Use Declarative Mode** (not Framework/SSR mode).
This means `<BrowserRouter>` + `<Routes>` — no Vite plugin, no file-based routing, no SSR.

There is one `index.html`. The `/builder` route is handled entirely by React Router in the browser
— no `builder.html` file is needed.

```ts
// packages/web/src/router.tsx
import { BrowserRouter, Route, Routes } from "react-router"
import { BuilderPage } from "./pages/BuilderPage"
import { JobsPage } from "./pages/JobsPage"

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<JobsPage />} />
        <Route path="/builder" element={<BuilderPage />} />
      </Routes>
    </BrowserRouter>
  )
}
```

**Query string state**: use `useSearchParams()` from `react-router`. This preserves existing patterns like `?mock=1`, `?fake=1`, and `?step=...`. No changes to mental model.

**Why not Framework mode**: you don't need SSR, file-based routing, or server actions. Declarative mode is the right-sized tool.

**Why not TanStack Router**: React Router v7 declarative mode is simpler for this SPA and is the industry standard. TanStack Router is better when you need full type-safe URL search params from the start — defer this if needed.

---

## Data Fetching: TanStack Query v5

Use **TanStack Query v5** (`@tanstack/react-query`) for all server-state management.

Pairs with the auto-generated OpenAPI types from `openapi-fetch` (already in deps).

```ts
// Example: fetch job list
import { useQuery } from "@tanstack/react-query"
import { client } from "../api/client"

export function useJobs() {
  return useQuery({
    queryKey: ["jobs"],
    queryFn: () => client.GET("/jobs").then((response) => response.data),
  })
}
```

Mount `<QueryClientProvider>` at the root in `app.tsx`.

**Why TanStack Query**: Handles loading/error states, caching, background refetch, and SSE invalidation cleanly. Works directly with the OpenAPI-generated client.

---

## OpenAPI Schema Auto-Generation

The frontend needs typed API client code. **Do not maintain types by hand.**

### Strategy

Generate TypeScript types from the running API server's `/openapi.json` endpoint using `openapi-typescript` (already in devDependencies).

**The generated file is NOT committed to git.** Add to `.gitignore`:
```
packages/web/src/api/schema.generated.ts
```

### Scripts

The project already has `src/generateSchemas.ts` that generates schemas programmatically.
In the monorepo it moves to `packages/server/src/generateSchemas.ts`.
The npm script calls it directly via `tsx` — do not replace this with a raw `openapi-typescript` CLI call.

```json
"generate-schemas": "tsx --env-file ./.env packages/server/src/generateSchemas.ts"
```

Update `generateSchemas.ts` to write output to `packages/web/src/api/schema.generated.ts`
(currently writes to `src/schema.generated/`; the output path is the only thing that changes).

### Developer Workflow

1. `yarn workspace @media-tools/server run start` (start Hono on :3000)
2. `yarn generate-schemas` (calls the existing TS file; writes `schema.generated.ts`)
3. `yarn workspace @media-tools/web run dev` (Vite can now compile)

### Docker / CI Workflow

The Docker image must have the generated schema baked in. **Do not spin up a server during `docker build`.**

Instead, in the GitHub Actions `deploy.yml` workflow, add a pre-build step:

```yaml
- name: Start API server and generate schemas
  run: |
    yarn workspace server run start &
    SERVER_PID=$!
    sleep 5   # wait for Hono to be ready
    yarn generate-schemas
    kill $SERVER_PID
- name: Build and push Docker image
  uses: docker/build-push-action@v7
  # ... existing config
```

The generated `schema.generated.ts` is present in the build context even though it's gitignored.
The `Dockerfile` `COPY . .` step picks it up.

**Note**: Do not regenerate in Docker build itself (no server available during build).
Do not make the client code depend on a file that must be fetched at runtime.

---

## Vite + Hono Coexistence

### Development (Two Processes)

Run each server in its own terminal. Do not use `concurrently`.

```
Terminal 1: yarn workspace @media-tools/server run start  → Hono API on :3000
Terminal 2: yarn workspace @media-tools/web run dev       → Vite frontend on :5173
```

Optionally, add a root-level `dev` script to `package.json` that uses Yarn 4's native parallel runner:

```json
"dev": "yarn workspaces foreach --all --parallel --interlaced run dev"
```

This is Yarn 4's built-in mechanism — no extra dependency needed.

Modify `packages/server/src/api/hono-routes.ts` to proxy to Vite in dev:

```ts
if (process.env.NODE_ENV === "development") {
  // Proxy non-API requests to Vite dev server
  app.use("*", async (c) => {
    const res = await fetch(`http://localhost:5173${c.req.path}`)
    return res
  })
} else {
  // Production: serve built Vite output
  app.use(serveStatic({ root: "./dist" }))
}
```

Hono owns the public origin (`:3000`). Vite's HMR WS goes to `:5173` directly.
API routes, SSE, and WebSocket connections go to Hono only, never to Vite.

### Production (Single Process)

`yarn build:web` → outputs to `packages/web/dist/`.
Hono serves that dir as static files at `/*` (the prod branch above).
One process, one port. This is the same architecture as today.

---

## State Architecture: Jotai + Transitional Bridge

### Atoms

One file per atom or atom group. No barrel files in `state/`.

| File | Atom(s) | Replaces |
|------|---------|---------|
| `stepsAtom.ts` | `stepsAtom`, `stepCounterAtom` | `sequence-state.steps`, `.stepCounter` |
| `pathsAtom.ts` | `pathsAtom` | `sequence-state.paths` |
| `historyAtoms.ts` | `undoStackAtom`, `redoStackAtom`, `pushSnapshotAtom`, `undoAtom`, `redoAtom` | undo/redo snapshot stack |
| `uiAtoms.ts` | `selectedStepIdAtom`, `openModalsAtom`, `dryRunAtom`, `failureModeAtom` | DOM `.hidden` flags |
| `flattenedStepsAtom.ts` | `flattenedStepsAtom` (derived, read-only) | `flattenSteps()` call |
| `commandsAtom.ts` | `commandsAtom` (constant) | `COMMANDS` import |

### Transitional Bridge (`state/bridge.ts`)

During PR #2 through the Final PR, legacy JS still exists and reads/writes `window.mediaTools`.
The bridge syncs it with Jotai atoms using `getDefaultStore()`:

```ts
import { getDefaultStore } from "jotai"
import { stepsAtom } from "./stepsAtom"
import { pathsAtom } from "./pathsAtom"

const store = getDefaultStore()

Object.defineProperty(window, "mediaTools", {
  value: {
    get steps() { return store.get(stepsAtom) },
    set steps(v) { store.set(stepsAtom, v) },
    get paths() { return store.get(pathsAtom) },
    set paths(v) { store.set(pathsAtom, v) },
    // add other getters/setters as needed per legacy usage
  },
})
```

**Call `initBridge()` once, at the top of `app.tsx`, before React renders.**
Delete `bridge.ts` in the Final PR when all legacy JS is gone.

---

## Shared npm Library (`packages/shared`)

### Purpose

The `media-sync` sibling repo at `../media-sync` has copy-pasted utilities from this codebase
(confirmed: `logMessage.ts`, `naturalSort.ts`, `createRenameFileOrFolder.ts`, and others in
`packages/shared-tools/src/`). Moving these to a shared npm package ends double-maintenance.

### Package Configuration

```json
{
  "name": "@media-tools/shared",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": "./dist/index.js" },
  "files": ["dist"],
  "publishConfig": { "access": "public" }
}
```

Root export file (`packages/shared/src/index.ts`) re-exports all public utilities.
This is the ONE acceptable barrel file in the project (at the npm package boundary).

### npm Publishing via GitHub Actions

New workflow: `.github/workflows/publish-shared.yml`

```yaml
name: Publish @media-tools/shared
on:
  push:
    tags: ["shared-v*.*.*"]
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          registry-url: "https://registry.npmjs.org"
      - run: corepack enable && yarn install
      - run: yarn workspace @media-tools/shared run build
      - run: yarn workspace @media-tools/shared npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Setup required**: Add `NPM_TOKEN` secret to GitHub repo settings.
Tag format: `git tag shared-v1.0.0 && git push --tags`

### Workspace Dependency in Server and Web

Both `packages/server` and `packages/web` declare `@media-tools/shared` as a `workspace:*` dependency:

```json
// packages/server/package.json and packages/web/package.json
"dependencies": {
  "@media-tools/shared": "workspace:*"
}
```

`workspace:*` means Yarn resolves the package directly from `packages/shared/` in the monorepo — no publish step needed during development. When Changesets publishes a release, it automatically rewrites `workspace:*` to the pinned version number (`"^1.2.0"`) in the published artifact. Consumers in `media-sync` get the real version; the monorepo uses the live source.

### Parallel Workstream: media-sync Migration

**Blocks on**: `@media-tools/shared` v0.1.0 published to npm (happens in PR #1).
**Independent of**: React wave work (Waves A–F). Can run concurrently.
**Repo**: `../media-sync` (separate repo, separate PRs).

Once `@media-tools/shared` is published:

1. In `media-sync`, add `@media-tools/shared` to the relevant workspace packages
2. Replace each copy-pasted file in `media-sync/packages/shared-tools/src/` with an import from `@media-tools/shared`
3. Delete the now-redundant files from `media-sync/packages/shared-tools/src/`
4. If `shared-tools` becomes empty, remove the package entirely and update its dependents

Known overlapping files (confirmed by codebase comparison):

- `logMessage.ts`, `naturalSort.ts`, `createRenameFileOrFolder.ts`, `captureLogMessage.ts`,
  `catchNamedError.ts`, `rethrowNamedError.ts`, `makeDirectory.ts`, `aclSafeCopyFile.ts`,
  `readFiles.ts`, `readFilesAtDepth.ts`, `readFolders.ts`

This is a good task to assign to a separate AI worker once PR #1 is merged and the package is live on npm.

---

## CI: GitHub Actions

Add a new workflow: `.github/workflows/ci.yml`

This runs on every PR targeting `react-migration` or `master`, and on every push to `react-migration`.
**All jobs must pass before a PR can merge** (enforce via GitHub branch protection rules on `react-migration`).

```yaml
name: CI
on:
  pull_request:
    branches: [react-migration, master]
  push:
    branches: [react-migration]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24 }
      - run: corepack enable && yarn install --immutable
      - run: yarn biome check          # format + lint; exits non-zero if any file is wrong
      - run: yarn eslint .             # react-compiler + testing-library + no-barrel-files

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24 }
      - run: corepack enable && yarn install --immutable
      - run: yarn generate-schemas     # needs server; see note below
      - run: yarn typecheck

  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24 }
      - run: corepack enable && yarn install --immutable
      - run: yarn workspace @media-tools/web dlx playwright install chromium --with-deps
      - run: yarn generate-schemas
      - run: yarn test                 # both vitest projects (node + browser/chromium)

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24 }
      - run: corepack enable && yarn install --immutable
      - run: yarn playwright install chromium --with-deps
      - run: yarn generate-schemas
      - run: yarn build:web            # E2E runs against production build
      - run: yarn e2e                  # Playwright; webServer config starts Hono automatically
```

### Biome Formatting in CI

`biome check` (no `--write` flag) checks both formatting and linting without modifying files.
It exits with a non-zero code if any file is unformatted or has a lint error — CI fails, PR is blocked.

**Developer workflow**: run `yarn lint` (which runs `biome check --write`) locally before committing.
**CI**: runs `biome check` (read-only check). Never runs `--write` in CI.

To make this frictionless, consider adding a pre-commit hook so formatting happens automatically:

```json
// package.json (root)
"simple-git-hooks": {
  "pre-commit": "yarn biome check --write --staged"
},
"lint-staged": {
  "*.{ts,tsx,js,json}": "biome check --write"
}
```

Or skip the hook if you prefer to format manually. The CI gate is the hard requirement; the hook is optional convenience.

### Schema Generation in CI

`typecheck`, `unit-tests`, and `e2e` jobs all need `schema.generated.ts` before TypeScript can compile.
Each job starts the Hono server, generates schemas, then kills the server before running its actual task.

Add a reusable shell script `scripts/generate-schemas-ci.sh`:

```bash
#!/usr/bin/env bash
yarn workspace @media-tools/server run start &
SERVER_PID=$!
# Wait for Hono to be ready (poll /health or just sleep)
npx wait-on http://localhost:3000/openapi.json --timeout 30000
yarn generate-schemas
kill $SERVER_PID
```

Call it in each CI job that needs schemas before `yarn generate-schemas` in the steps above.
(`wait-on` is a small utility that polls a URL; add it to root devDependencies.)

### Automated Versioning: Changesets

Use `@changesets/cli` for automated version bumping as PRs merge.

**Two version streams:**

- `@media-tools/server` + `@media-tools/web` — always bump together (one app version, shared by the Docker image tag and any UI version display)
- `@media-tools/shared` — bumps independently; its version is what consumers in `media-sync` pin to

**Setup** (done in PR #1):

```bash
yarn add -D @changesets/cli
yarn changeset init
```

Configure `.changeset/config.json`:
```json
{
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "linked": [["@media-tools/server", "@media-tools/web"]],
  "access": "restricted",
  "baseBranch": "react-migration",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

Set `"access": "public"` for `@media-tools/shared` in its own `package.json` — Changesets respects per-package `publishConfig.access`.

**PR author workflow** (each AI worker follows this per PR):
```bash
yarn changeset        # interactive: pick packages affected, bump type, write description
git add .changeset/
git commit -m "chore: add changeset"
```

**On merge to `react-migration`** — a GitHub Action runs automatically:

Add to `.github/workflows/ci.yml` a new job (runs only on push to `react-migration`, not on PRs):
```yaml
  version:
    if: github.event_name == 'push' && github.ref == 'refs/heads/react-migration'
    runs-on: ubuntu-latest
    needs: [lint, typecheck, unit-tests]
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24 }
      - run: corepack enable && yarn install --immutable
      - uses: changesets/action@v1
        with:
          publish: yarn changeset publish   # only publishes @media-tools/shared to npm
          title: "chore: version packages"
          commit: "chore: version packages"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

This creates a "Version PR" automatically. When you merge the Version PR, package.json files are bumped and `@media-tools/shared` is published to npm if it has pending changesets.

The Docker image is tagged with the server package version (already done in `deploy.yml` via the SHA tag; add a version tag too).

---

### Branch Protection (GitHub Settings — done once by repo owner)

In GitHub repo Settings → Branches → Add rule for `react-migration`:

- Require status checks to pass: `lint`, `typecheck`, `unit-tests`, `e2e`
- Require branches to be up to date before merging
- Do NOT require `deploy` (the Docker build) — that only runs on `master`

---

## Docker + nginx-proxy-manager

### Current Dockerfile

The existing `Dockerfile` runs a single process: `yarn start-server` (Hono API on `$PORT`).

### Updated Architecture

In the final state, the Docker container runs **both** the API server (Hono) and the web server
(Hono serving the Vite-built static files as one process — see Vite + Hono Coexistence section).

Because Hono serves both API routes AND the built frontend in production, **you still have one process**.
The `start-docker` script is just `yarn start-server` (no change needed here).

nginx-proxy-manager sits in front and routes:
- `app.yourdomain.com` → container port `$PORT` (serves both API at `/api/*` and frontend at `/*`)

### Environment Variables

Add to `Dockerfile` and document in a `.env.example`:

```
PORT=3000                    # Hono server port (serves both API + frontend)
API_PORT=3000                # alias; some scripts use this name
NODE_ENV=production
```

If you ever split the API and web into separate ports (future decision), add:
```
VITE_API_BASE_URL=/api       # used by frontend at build time to prefix API calls
```

For now, the frontend uses relative paths (e.g., `/api/jobs`) so no `VITE_API_BASE_URL` is needed.
Relative paths work naturally when nginx-proxy-manager routes everything to the same origin.

### CMD Update

Update `Dockerfile` CMD to use the new monorepo structure:

```dockerfile
# In the existing Dockerfile, update the final CMD:
CMD ["yarn", "workspace", "@media-tools/server", "run", "start-server"]
```

Or add a root-level `start-docker` script to `package.json` that does the same.

---

## Tooling Stack

### Biome (Primary: Format + Lint)

**Biome v2** handles formatting and most linting. Full format+lint mode enabled.

First run will reformat existing server-side files (including the hand-styled
`src/tools/addFolderNameBeforeFilename.ts`). This is a one-time cost — accept it.

Biome natively covers:
- JS, TS, JSX formatting (2-space indent, double quotes, trailing commas, semicolons)
- React hooks rules, JSX best practices
- Import ordering and deduplication
- Accessibility rules (jsx-a11y equivalent)
- Code quality (unicorn-style rules, no-console, etc.)

Config (`biome.json` at root):
```json
{
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2 },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "style": {
        "noSingleCharacterLengthVariables": "error"
      }
    }
  },
  "javascript": { "formatter": { "quoteStyle": "double", "trailingCommas": "all", "semicolons": "always" } }
}
```

Scripts (add to root `package.json`):
- `yarn lint` — alias for Biome and ESLint autofix.

### ESLint (Minimal: Two Plugins Only)

ESLint is kept only for two specialized plugins Biome has not yet ported:

1. **`eslint-plugin-react-compiler`** — error when code pattern prevents React Compiler from optimizing
2. **`eslint-plugin-testing-library`** — warn on getByText/findByText when getByRole should be used

```ts
// eslint.config.js
import reactCompiler from "eslint-plugin-react-compiler"
import testingLibrary from "eslint-plugin-testing-library"
import importX from "eslint-plugin-import-x"

export default [
  {
    plugins: { "react-compiler": reactCompiler },
    rules: { "react-compiler/react-compiler": "error" },
  },
  {
    files: ["**/*.test.{ts,tsx}"],
    plugins: { "testing-library": testingLibrary },
    rules: {
      "testing-library/prefer-screen-queries": "warn",
      "testing-library/no-container": "warn",
      "testing-library/no-node-access": "warn",
    },
  },
  {
    plugins: { "import-x": importX },
    rules: { "import-x/no-barrel-files": "error" },
  },
]
```

### React Compiler (Auto-Memoization)

React 19 + `babel-plugin-react-compiler` auto-memoizes components and hook return values.
**Do not use** `useMemo`, `useCallback`, or `React.memo` manually — the compiler handles it.

The only exception: when exporting a stable reference across a module boundary that a
non-React subscriber needs to remain stable (document this with a comment).

Enabled via `vite.config.ts`:
```ts
react({
  babel: {
    plugins: [["babel-plugin-react-compiler", { target: "19" }]],
  },
})
```

`eslint-plugin-react-compiler` warns when code patterns prevent optimization.
Treat these as errors — they are real bugs (mutations in render, conditional hooks, etc.).

### Testing

- **Vitest 4** — two projects: "node" (server logic) + "browser" (React components in real Chromium)
- **@testing-library/react** — component tests; `getByRole` first, `getByText` only as fallback
- **@testing-library/user-event** — user interaction simulation
- **@testing-library/jest-dom** — extended matchers (`toBeInTheDocument`, etc.)
- **Playwright** — E2E tests in `e2e/`; keep separate; do not consolidate into Vitest

Test file rule: `ComponentName.test.tsx` lives next to `ComponentName.tsx`.
No separate `__tests__/` folders for component tests.

### Storybook v10

**Storybook 10** with `@storybook/react-vite`.

Addons: `@storybook/addon-a11y`, `@storybook/addon-vitest`, `@storybook/addon-themes`.

Story colocation: `LoadModal.stories.tsx` and `LoadModal.mdx` live next to `LoadModal.tsx`.
MDX docs are hand-authored (not autodocs). Use `<Controls />` and `<ArgTypes />` inside MDX
to embed auto-generated prop tables where useful.

Global decorator (`preview.ts`): wrap all stories in Jotai `<Provider>`, apply Tailwind CSS,
enable MSW via `msw-storybook-addon`.

Scripts:
- `yarn storybook` — dev on `:6006`
- `yarn build-storybook` — static output for deployment

### Tailwind v4 + Vite

Replace the CDN runtime (`public/vendor/tailwind-3.4.17.js`) with **Tailwind v4** + `@tailwindcss/vite`.

CSS file naming (no `index.css`):
- `packages/web/src/styles/tailwindStyles.css` — `@import "tailwindcss";` only
- `packages/web/src/styles/builderStyles.css` — the existing 325-line custom CSS (unchanged)
- `packages/web/src/styles/jobsStyles.css` — custom CSS for jobs page (if any)

Both are imported as side-effects in `app.tsx`. No `@apply`. No CSS Modules.

---

## Migration Path

### PR #1: Bootstrap (no behavior changes)

**Goal**: Monorepo scaffolding, Vite running, legacy JS still drives the app.
**Branch**: `react-migration`
**Single worker**; must be done before any wave work.

Tasks:
1. Restructure repo into `packages/server/`, `packages/web/`, `packages/shared/`
2. Update root `package.json` with `workspaces: ["packages/*"]`
3. Create `tsconfig.base.json`, update each workspace's `tsconfig.json`
4. Add `vite.config.ts` in `packages/web/` with `@vitejs/plugin-react` (React Compiler enabled), `@tailwindcss/vite`
5. Create `packages/web/index.html` (single entry; references `src/app.tsx`; no `builder.html` needed)
6. Create `packages/web/src/app.tsx` — boots Jotai `Provider`, MSW opt-in, mounts React Router, imports legacy JS as side-effect
7. Create `packages/web/src/router.tsx` — `<BrowserRouter>` with two `<Route>` entries (stub `BuilderPage`, stub `JobsPage` in `src/pages/`)
8. Create `packages/web/src/styles/tailwindStyles.css` and `builderStyles.css` (copied from `public/builder/builder.css`)
9. Create Biome config (`biome.json`)
10. Create minimal ESLint config (`eslint.config.js`)
11. Run `msw init packages/web/public/`
12. Create `packages/shared/` with the utility files listed in the architecture section
13. Publish first `@media-tools/shared` version (v0.1.0) to npm
14. Add Hono dev proxy to `packages/server/src/api/hono-routes.ts`
15. Add `start-docker` script; update `Dockerfile` CMD
16. Create `.github/workflows/publish-shared.yml`
17. Add `schema.generated.ts` to `.gitignore`
18. Add `generate-schemas` script to root `package.json`
19. Create `docs/react-migration-plan.md` (copy this document)
20. Create `docs/react-migration-checklist.md`
21. Archive `docs/CHECKLIST.md` → `docs/archive/CHECKLIST-2026-05-08.md`
22. Archive stale docs → `docs/archive/`

**Verification**:
- `yarn workspace web run dev` starts Vite without errors
- `http://localhost:3000/builder` still loads and the builder works (legacy JS)
- `http://localhost:3000/` still loads and jobs page works
- `yarn biome check` passes
- `yarn eslint .` passes
- No TypeScript errors (`yarn typecheck`)

### PR #2: First Component — LoadModal

**Goal**: One React component replaces one legacy JS file, end-to-end.
**Depends on**: PR #1 merged to `react-migration`.
**Single worker**; this is the template all subsequent conversions follow.

Tasks:
1. Create all Jotai atoms needed by LoadModal: `stepsAtom`, `pathsAtom`, `historyAtoms`, `uiAtoms` (specifically `loadModalOpenAtom`)
2. Create `packages/web/src/state/bridge.ts` and call `initBridge()` from `app.tsx`
3. Create `packages/web/src/components/LoadModal.tsx` (React + `useAtom`)
4. Create `packages/web/src/components/LoadModal.stories.tsx` and `LoadModal.mdx`
5. Create `packages/web/src/components/LoadModal.test.tsx` (`@testing-library/react`, `getByRole`)
6. In `app.tsx`, mount `<LoadModal />` into the `#load-modal-container` DOM node via `createRoot`
7. Delete `public/builder/js/components/load-modal.js` and its import from `public/builder/js/main.js`
8. Update `docs/react-migration-checklist.md`

**Verification**:
- Click "Load YAML" → modal opens (React-rendered)
- Paste valid YAML → sequence loads into builder (legacy JS still renders steps)
- `LoadModal.test.tsx` passes in Vitest browser project
- `LoadModal` story renders in Storybook
- No console errors; no regressions in other modals

### PR #3+: Waves of Parallelizable Conversions

Each wave can be divided across multiple AI workers on separate worktrees.
Workers follow the exact recipe established in PR #2 for each component.

**Wave A** — leaf components (no dependencies on other in-progress React components):
- `YamlModal`, `CommandHelpModal`, `FieldTooltip`, `CollapseChevron`, `CopyIcon`, `InsertDivider`, `StatusBadge`
- Parallelizable: assign one component per worker

**Wave B** — fields (shared field-rendering protocol):
- Convert `RenderFields.tsx` first (one worker, blocks the rest)
- Then (parallelizable): `BooleanField`, `EnumField`, `StringField`, `NumberField`, `PathField`, `JsonField`, `LanguageCodeField`, `LanguageCodesField`, `NumberArrayField`, `StringArrayField`, `NumberWithLookupField`, `SubtitleRulesField`

**Wave C** — pickers (need `Popover` primitive first):
- Build `packages/web/src/primitives/Popover.tsx` (Radix `@radix-ui/react-popover`, one worker)
- Then (parallelizable): `CommandPicker`, `EnumPicker`, `LinkPicker`, `PathPicker`

**Wave D** — cards (depend on Wave B fields + Wave C pickers):
- `StepCard`, `GroupCard`, `PathVarCard`
- `DragAndDrop` — wrap existing `Sortable.js` library in a `useEffect`; do not replace the library

**Wave E** — page structure (depends on all prior waves):
- `PageHeader` (converts inline HTML; exposes `openLoadModal` via atom instead of global function)
- `LookupModal`, `FileExplorerModal`, `RunSequence`, `ApiRunModal`, `PromptModal`
- `DslRulesBuilder` (complex; treat as its own PR with sub-components)

**Wave F** — Jobs page (independent from Waves A–E; can start any time after PR #1):
- `JobCard`, `StatusBar`, `SseStream` (no dependencies on builder components)
- `JobsPage.tsx` becomes a real page after wave F

**Final PR** — cleanup (after all waves complete, user confirms):
- Delete `public/builder/`, `public/jobs/`, `public/builder/index.html`
- Delete `packages/web/src/state/bridge.ts` and all references to `window.mediaTools`
- Delete `packages/web/index.html` dual-entry HTML if still present
- Collapse multiple `createRoot()` calls into a single root in `app.tsx`
- Remove legacy vendor scripts: `public/vendor/tailwind-3.4.17.js`, `public/vendor/js-yaml.min.js`, `public/vendor/Sortable.min.js`
- `@react-router/dom` `<BrowserRouter>` now drives full-page routing (no more progressive mounting)

---

## Critical Files to Create or Modify

### New files (PR #1)
- `packages/server/package.json`
- `packages/web/package.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`
- `packages/web/src/app.tsx`, `router.tsx`
- `packages/web/src/styles/tailwindStyles.css`, `builderStyles.css`
- `packages/shared/package.json`, `packages/shared/src/index.ts`, all utility files
- `tsconfig.base.json`
- `biome.json`
- `eslint.config.js`
- `.github/workflows/publish-shared.yml`
- `docs/react-migration-plan.md`, `docs/react-migration-checklist.md`

### Modified files (PR #1)
- `package.json` (root) — add `workspaces`, scripts
- `packages/server/src/api/hono-routes.ts` — add dev proxy
- `Dockerfile` — update CMD
- `.gitignore` — add `schema.generated.ts`

### Generated (not committed)
- `packages/web/src/api/schema.generated.ts`

---

## Verification

### Development Workflow
1. `yarn install`
2. `yarn workspace server run start` (terminal 1 → API on :3000)
3. `yarn generate-schemas` (generates typed API client)
4. `yarn workspace web run dev` (terminal 2 → Vite on :5173)
5. Open `http://localhost:3000/` → Jobs page (proxied via Hono → Vite)
6. Open `http://localhost:3000/builder` → Builder page
7. `http://localhost:6006` → Storybook

### Per-PR Verification Checklist
- `yarn biome check` → 0 errors
- `yarn eslint .` → 0 errors (react-compiler violations are errors, not warnings)
- `yarn typecheck` → 0 errors
- `yarn test` → all pass (node + browser projects)
- `yarn e2e` → all pass (Playwright, run against real Hono server)
- Manual: navigate to `/` and `/builder`, verify no console errors, verify feature works

### Production Build Check
```bash
yarn build:web          # Vite bundle → packages/web/dist/
yarn workspace server run start-server   # Hono serves dist/
# Open http://localhost:3000 — should load built React app, not Vite dev server
```

---

## Post-Migration: Rename to MuxMagic

**Planned after the Final PR is merged and the user confirms migration complete.**

The project will be renamed from `media-tools` → **MuxMagic**. This is a pure rename — no architecture changes.

Scope of the rename:

| Item | Before | After |
|------|--------|-------|
| npm package scope | `@media-tools/server`, `@media-tools/web`, `@media-tools/shared` | `@muxmagic/server`, `@muxmagic/web`, `@muxmagic/shared` |
| GitHub repo | `media-tools` | `muxmagic` |
| Local directory | `d:/Projects/Personal/media-tools` | `d:/Projects/Personal/muxmagic` |
| Docker image | `ghcr.io/<owner>/media-tools` | `ghcr.io/<owner>/muxmagic` |
| npm published package | `@media-tools/shared` | `@muxmagic/shared` (republish under new scope; deprecate old) |

**Until then**: all workers continue using `@media-tools/*` package names and the `media-tools` directory. Do not pre-emptively rename any package name, import path, or workspace reference during the React migration phases. The rename is a single dedicated pass after the Final PR.

The local directory and repo rename requires coordination outside this repo (CI config, nginx-proxy-manager labels, any `media-sync` `package.json` references). The user will handle this manually after migration is done.

---

## Things We Are NOT Doing

- **SSR or React Server Components** — this is a local-user tool, SPA is correct
- **React Router Framework mode** — no file-based routing, no server actions needed
- **Form library** (`react-hook-form`, `formik`) — Jotai handles form state
- **ShadCN pre-installed components** — start with Radix + Tailwind; add ShadCN if duplication appears
- **Icon library** — inline SVGs as React components in `icons.tsx`
- **CSS-in-JS**, CSS Modules — Tailwind + global CSS files
- **XState / state machines** — not yet; the existing imperative approach works
- **Auth** — out of scope for this tool
- **Publishing `@media-tools/web` to npm** — only `@media-tools/shared` is published
- **Converting media-sync to React** — that happens after this migration is done and the shared library is published

---

## AI Model Guide

Use this to decide which Claude model to assign to each worker task.

**Models referenced:**

- **Opus** (`claude-opus-4-7`) — highest capability; use for architecture and novel design decisions
- **Sonnet** (`claude-sonnet-4-6`) — balanced; use with extended thinking for moderately complex work
- **Haiku** (`claude-haiku-4-5`) — fast and cheap; use with thinking enabled for clear pattern-execution

> Haiku does not have adjustable effort levels (low/medium/high thinking budget) the way Sonnet does,
> but it does support thinking. Enable it for any task marked "Haiku (thinking)".

| Task | Model | Effort | Reason |
| ---- | ----- | ------ | ------ |
| **PR #1: Bootstrap** | Opus | — | Sets the entire foundation; architectural mistakes here cascade to all 77+ subsequent PRs |
| **PR #2: LoadModal (template)** | Sonnet | High | First component establishes the pattern every wave worker follows; must be correct |
| **Wave A: leaf components** | Haiku | Thinking | Mechanical conversions; pattern established by PR #2 |
| **Wave B: RenderFields dispatcher** | Sonnet | Medium | Field dispatch table design needs care; all field workers depend on it |
| **Wave B: individual field types** | Haiku | Thinking | Mechanical once dispatcher exists |
| **Wave C: Popover primitive** | Sonnet | Medium | Radix integration + keyboard/focus behavior needs careful thought |
| **Wave C: individual pickers** | Haiku | Thinking | Mechanical; primitive already built |
| **Wave D: StepCard, GroupCard, PathVarCard** | Sonnet | Medium | Complex prop threading through many components |
| **Wave D: DragAndDrop (Sortable wrapper)** | Sonnet | High | React ↔ imperative library interop is non-trivial; ref lifecycle is subtle |
| **Wave E: PageHeader, LookupModal** | Sonnet | Medium | Multi-component trees but predictable structure |
| **Wave E: RunSequence, ApiRunModal** | Sonnet | High | SSE streaming + job state coordination is complex |
| **Wave E: DslRulesBuilder** | Opus | — | Most complex builder component; many sub-states and interactions |
| **Wave F: Jobs page** | Haiku | Thinking | Simpler than builder; SSE pattern is already established in the codebase |
| **Final PR: cleanup** | Sonnet | Medium | Deleting bridge + consolidating roots; needs careful regression checking |
| **media-sync workstream** | Haiku | Thinking | Mechanical file replacements once shared package is published |
| **CI / Changesets / tooling setup** | Sonnet | Low | Config-heavy but well-documented; mistakes are easy to catch |
| **Per-PR changeset descriptions** | Haiku | — | Trivial; describe what changed in plain English |

**Estimated worker concurrency by wave:**

- **Wave A**: 4–5 workers (each takes one leaf component)
- **Wave B fields**: 6–8 workers after RenderFields merges
- **Wave C pickers**: 2–3 workers after Popover merges
- **Wave D**: 3 workers (one per card type; DragAndDrop is its own)
- **Wave E**: 2–3 workers (split by component complexity)
- **Wave F**: 1 worker (Jobs page is simpler and smaller)
- **media-sync**: 1 worker, runs in parallel with any wave

---

## react-migration-checklist.md Template

Create this file at `docs/react-migration-checklist.md`. AI workers update it after each PR.

```markdown
# React Migration Checklist

Last updated: [date] by [worker/AI]

## Phase Status

| PR | Description | Status | Branch | Notes |
|----|-------------|--------|--------|-------|
| PR #1 | Bootstrap (monorepo, Vite, Biome, Storybook) | [ ] Not started | react-migration | |
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
- Biome (primary) + ESLint (react-compiler + testing-library only)
- Storybook v10 with MDX docs per component
- Playwright for E2E; Vitest browser for component tests
- No barrel files (except packages/shared/src/index.ts)
- OpenAPI schema auto-generated from running server; not committed to git

## Open Questions / Blockers

[AI workers: add blockers here rather than guessing]
```
