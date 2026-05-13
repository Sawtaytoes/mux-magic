# Worker 39 — shared-to-tools-rename

**Model:** Sonnet · **Thinking:** ON · **Effort:** High
**Branch:** `feat/mux-magic-revamp/39-shared-to-tools-rename`
**Worktree:** `.claude/worktrees/39_shared-to-tools-rename/`
**Phase:** 0
**Depends on:** none — runs in parallel with `02`, `03`, `04`. Worker `01` (mux-magic-rename) **must run after** this lands.
**Parallel with:** 02 03 04 (worker 01 explicitly **waits** for 39)

---

## Universal Rules

1. **Branch & worktree — create them first**
   ```powershell
   git fetch origin
   git worktree add .claude/worktrees/39_shared-to-tools-rename -b feat/mux-magic-revamp/39-shared-to-tools-rename feat/mux-magic-revamp
   cd .claude/worktrees/39_shared-to-tools-rename
   ```

2. **Port + PID protocol** — see [04's prompt](04_worker-conventions-agents-md.md) or AGENTS.md (after `04` lands).

3. **Pre-push gate:** `yarn lint → yarn typecheck → yarn test → yarn e2e → yarn lint`. The rename + selective file move touches enough surface area to warrant all five gates.

4. **TDD:** for a rename + selective move, the "tests" are `yarn typecheck` + `yarn test` passing across all workspaces. If a moved utility had unit tests in `packages/server/src/tools/`, the tests move with the file. If you discover a behavior break caused by the move, write a failing test that reproduces it before fixing.

5. **Commit-and-push as you go.** Break the work into logical chunks (see "Suggested commit order"). Update your row in [docs/workers/README.md](README.md).

6. **Yarn only.** Never npm/npx.

---

## Your Mission

Two coordinated changes:

1. **Rename `packages/shared/` → `packages/tools/`**, and the npm scope `@media-tools/shared` → `@media-tools/tools`. (Worker `01` later renames `@media-tools/*` → `@mux-magic/*` across the board, so after both ship the final scope is `@mux-magic/tools`.)
2. **Selectively move reusable utilities from `packages/server/src/tools/` into `packages/tools/src/`.** "Reusable" means: not tied to this server's API/state/runtime — pure helpers a sibling tool (like Gallery-Downloader) could consume from npm.

**Why:** Gallery-Downloader currently has its own `packages/shared-tools/` with duplicated console-log helpers, file-lookup helpers, etc. Centralizing those into a single published `@mux-magic/tools` package lets Gallery-Downloader (and any future sibling) consume one npm dep instead of duplicating logic.

### Naming conventions for this worker (use exactly these forms)

| Context | Before this worker | After this worker | After worker 01 |
|---|---|---|---|
| Directory | `packages/shared/` | `packages/tools/` | `packages/tools/` |
| npm scope | `@media-tools/shared` | `@media-tools/tools` | `@mux-magic/tools` |
| Workspace package name | `@media-tools/shared` | `@media-tools/tools` | `@mux-magic/tools` |
| Public entry barrel | `packages/shared/src/index.ts` | `packages/tools/src/index.ts` | (same) |
| Tag prefix for publish workflow | `shared-v*.*.*` | **Leave as-is** (`shared-v*.*.*`) — package-agnostic tag prefix | (same) |

The directory rename is the load-bearing change; the package name update flows from it. Do not change the workspace package name to `@media-tools/tools` until **after** the directory is renamed (otherwise yarn workspace resolution will be broken mid-commit).

---

## Phase A — Rename the package (commits 1–4)

### 1. **`chore(tools): rename packages/shared/ → packages/tools/`**

> **NOTE:** The user will perform the actual directory rename in VSCode (it triggers VSCode's smart-rename which updates many import paths automatically). After the user's rename pass, this worker resumes for the rest of the commit chunks below.

- Confirm the directory moved cleanly: `packages/tools/` exists; `packages/shared/` is gone.
- Verify VSCode caught the imports: `Grep` for `packages/shared/` in `**/*.{ts,tsx,mjs,cjs,js,json}`. If any matches remain, update them to `packages/tools/`.
- Update `packages/tools/package.json#name`: `@media-tools/shared` → `@media-tools/tools`.
- Update root `package.json#workspaces` if it lists `packages/shared` explicitly (most monorepos use `packages/*`, but verify).
- Run `yarn install` to refresh `yarn.lock`.
- Run `yarn typecheck` — should pass before moving on.

### 2. **`chore(tools): update import paths @media-tools/shared → @media-tools/tools`**

- `Grep` for `@media-tools/shared` in `**/*.{ts,tsx,mjs,cjs,js}`. Confirm count, then `Edit --replace_all` per file (or scripted multi-Edit pass for >10 files).
- Also update any `dependencies` / `devDependencies` blocks in `packages/server/package.json`, `packages/web/package.json`, and root `package.json` that reference `"@media-tools/shared": "workspace:*"`.
- Update barrel-file comment in `packages/tools/src/index.ts`: replace any reference to "the only allowed barrel file" rationale to mention `@media-tools/tools` (worker `01` later changes this to `@mux-magic/tools`).
- Update [docs/agents/code-rules.md](../../docs/agents/code-rules.md) §9 "No barrel files" — the allowed-exception sentence currently names `packages/shared/src/index.ts`; change to `packages/tools/src/index.ts` and `@media-tools/tools`.

### 3. **`chore(tools): update CI workflow references`**

- [.github/workflows/publish-shared.yml](../../.github/workflows/publish-shared.yml) (already touched by worker `02`):
  - **Coordinate with worker 02.** If `02` has already merged, edit the file directly. If `02` is still in flight, add a PR comment noting the coordination point.
  - Replace `yarn workspace @media-tools/shared` → `yarn workspace @media-tools/tools` (worker 01 will later change to `@mux-magic/tools`).
  - Leave the tag prefix `shared-v*.*.*` unchanged — package-agnostic and avoids breaking historical tag triggers.
  - Consider renaming the workflow file `publish-shared.yml` → `publish-tools.yml`. **Do this** — file name should reflect the package. Update any references to the workflow file by name (rarely referenced; check `.github/`).

### 4. **`chore(tools): update test/config references`**

- `vitest.config.ts` at root and per-package configs — check if any list `packages/shared` explicitly. Update to `packages/tools`.
- `tsconfig.json`, `tsconfig.build.json` — check `references`, `paths`, `include`/`exclude` arrays.
- `eslint.config.js` — check for path filters or rule overrides keyed on `packages/shared`.
- `playwright.config.ts` — generally won't touch shared/tools, but Grep to confirm.

Run `yarn lint → yarn typecheck → yarn test` after this commit. Fix any leftover references before continuing to Phase B.

---

## Phase B — Selective move from `packages/server/src/tools/` → `packages/tools/src/` (commits 5–N)

### Selection criteria

A utility from `packages/server/src/tools/` moves into `packages/tools/src/` **only if all of these hold**:

1. **Pure function / pure module.** No server-state imports (no atoms, no router instance, no `globalThis`-mutating side effects).
2. **No imports from `packages/server/src/` outside of `tools/`** (the dependency must point INTO `tools/`, not OUT to server-specific code).
3. **No transitive npm deps that are server-only** (`express`, `puppeteer`, `playwright`, `chromium`, `socket.io`, etc.). Library deps that work in any Node context (`rxjs`, `fast-sort`, `zod`, etc.) are fine.
4. **Plausibly reusable by Gallery-Downloader** — the test is: would a sibling tool that does NOT have a server want to call this function? If yes → move it. If it's specific to this server's runtime → leave it.

### Strong move candidates (verify against criteria before moving)

Based on the `packages/server/src/tools/` enumeration, these are the most plausible candidates. **Run the criteria check on each before moving** — do not bulk-move blindly.

- **Console / log helpers** — `logMessage.ts`, `captureConsoleMessage.ts`, `captureLogMessage.ts`, `logAndRethrow.ts`, `logAndSwallow.ts`, `logPipelineError.ts` (assuming they don't depend on the server's structured logger).
- **File system primitives** — `getFiles.ts`, `getFilesAtDepth.ts`, `getFolder.ts`, `listDirectoryEntries.ts`, `listFilesWithMetadata.ts`, `makeDirectory.ts`, `deleteFiles.ts`, `replaceFileExtension.ts`, `cleanupFilename.ts`, `isNetworkPath.ts`, `pathSafety.ts`, `addFolderNameBeforeFilename.ts`.
- **String / array utilities** — `naturalSort.ts` (already in `packages/shared/`; the server has a DUPLICATE at `packages/server/src/tools/naturalSort.ts` — **delete the duplicate, keep the one in tools/**), `insertIntoArray.ts`, `getRandomString.ts`, `getDemoName.ts`.
- **Generic filters** — `filterIsAudioFile.ts`, `filterIsSubtitlesFile.ts`, `filterIsVideoFile.ts` (just file-extension matchers).
- **ISO language code tables** — `iso6391LanguageCodes.ts`, `iso6392LanguageCodes.ts`, `convertIso6391ToIso6392.ts`.

### Likely-STAY-in-server candidates (do not move)

- API search clients (`searchAnidb.ts`, `searchTvdb.ts`, `searchMovieDb.ts`, etc.) — tied to network-bound integrations; the server has caching infrastructure they depend on. **Reconsider individually** — some may meet the criteria.
- **`launchBrowser.ts`, `openInExternalApp.ts`** — use playwright/puppeteer (server-only deps).
- **`envVars.ts`** — server-specific env shape.
- **`taskScheduler.ts`** (NOT in tools/, but mentioned for context) — server-runtime scheduler; stays in server.
- **`initTaskSchedulerCli.ts`** — wires up scheduler to CLI mode; stays.
- **Anything under `__fixtures__/`** — test data co-located with its consumer.

### Move procedure (per file)

For each utility that meets the move criteria:

1. **Move the implementation file** — `packages/server/src/tools/<name>.ts` → `packages/tools/src/<name>.ts`. The user does this in VSCode (let VSCode smart-rename catch the imports).
2. **Move the test file (if any)** — `packages/server/src/tools/<name>.test.ts` → `packages/tools/src/<name>.test.ts`. The test runs under `packages/tools/`'s vitest config.
3. **Move any `__fixtures__/` referenced by the test** if they were tool-specific — otherwise leave fixtures next to their other consumers.
4. **Add to the public barrel** — `packages/tools/src/index.ts` exports the renamed function. Use the existing pattern: `export { foo } from "./foo.js"`.
5. **Update consuming imports across the monorepo:**
   - **External / cross-package consumers** (e.g., `packages/server/src/api/` importing the utility) — update to `import { foo } from "@media-tools/tools/src/foo"` (per [docs/agents/code-rules.md](../../docs/agents/code-rules.md) §9: inside the monorepo, import the file directly, not via the barrel).
   - **Same-package consumers within `packages/server/src/tools/`** that survive the move — update their imports to `@media-tools/tools/src/<name>`.
6. **Commit** with message `refactor(tools): move <name> from server/tools → tools/src` (one file per commit if a heavy refactor, batch related files if the move is mechanical).

### Workflow tip — pair file moves with the user

The user prefers to perform file moves in VSCode (it triggers smart-rename for imports). For each move:

1. Worker proposes the move (lists file + rationale + selection-criteria check).
2. User performs the move in VSCode.
3. Worker reviews the diff, fixes any imports VSCode missed, adds the barrel export, commits.

This loop is faster end-to-end than the worker doing the moves blind.

---

## Phase C — Cleanup (commits N+1)

### Final commit: `chore(tools): cleanup post-rename`

- Verify `packages/tools/src/index.ts` is the only barrel file in the repo (`Grep` for `^export \* from`, `^export {.*} from` in `**/src/index.{ts,tsx}` outside `packages/tools/`).
- `Grep` for `packages/shared` anywhere in `**/*.{ts,tsx,mjs,cjs,js,json,yml,yaml,md}` outside `docs/archive/` and `docs/react-migration-prompts/`. Should be zero hits. If any remain, they're historical references — leave them in archived docs but update active docs.
- `Grep` for `@media-tools/shared` repo-wide. Should be zero hits (`@mux-magic/tools` should also be zero — worker 01 hasn't run yet).
- Re-run the full gate: `yarn lint → yarn typecheck → yarn test → yarn e2e → yarn lint`.

---

## Files (high-level inventory; not exhaustive — use Grep)

Critical-blast-radius files (touch carefully):
- [packages/shared/](../../packages/tools) → `packages/tools/` (entire directory; user does the rename in VSCode)
- [packages/shared/package.json](../../packages/tools/package.json) (becomes `packages/tools/package.json` after rename)
- [package.json](../../package.json) (root — workspace globs and any internal devDependency refs)
- [yarn.lock](../../yarn.lock) (regenerated by `yarn install`)
- [.github/workflows/publish-shared.yml](../../.github/workflows/publish-shared.yml) (may be renamed to `publish-tools.yml`)
- [docs/agents/code-rules.md](../../docs/agents/code-rules.md) §9 (barrel-file exception sentence)

Pattern files (likely many; use `Grep` for exact list):
- All `**/*.{ts,tsx,mjs,cjs,js}` containing `@media-tools/shared` or `packages/shared/` — update import paths.
- All `**/*.{json,yml,yaml}` containing `@media-tools/shared` — update package refs.
- `packages/server/src/tools/**/*.ts` — selectively moved into `packages/tools/src/` per criteria.

### Files NOT to touch
- [docs/archive/](../../docs/archive/) — historical records
- [docs/react-migration-prompts/](../../docs/react-migration-prompts/) — historical worker prompts
- [docs/workers/w8*.md](../../docs/workers/), [docs/workers/w9*.md](../../docs/workers/) — historical
- [docs/w8-bug-fix-wave.md](../../docs/w8-bug-fix-wave.md) — historical
- `node_modules/`
- Anything under `.claude/worktrees/` (other workers in flight)
- API route paths, operationIds, schema field names — public API contract
- The npm tag prefix `shared-v*.*.*` — keep package-agnostic

---

## TDD steps

1. **Before any work:** `yarn lint → yarn typecheck → yarn test` to capture baseline. Save output so you can compare post-move.
2. After the directory rename (commit 1): `yarn typecheck` must pass before continuing.
3. After import-path update (commit 2): `yarn lint → yarn typecheck` must pass.
4. After CI workflow + config updates (commits 3–4): full gate.
5. For each utility move in Phase B: the moved file's existing test runs in the `packages/tools/` workspace and passes.
6. Final commit: full gate clean across all workspaces.

---

## Coordination with worker `01`

This worker (`39`) is **paired with `01`** (which does the `@media-tools` → `@mux-magic` rebrand). The order matters:

- **Run `39` BEFORE `01`.** After `39` ships, the package is `@media-tools/tools` (directory `packages/tools/`). Worker `01` then renames `@media-tools/*` → `@mux-magic/*` across the entire repo, which catches `@media-tools/tools` and turns it into `@mux-magic/tools`.
- If the user pushes a `shared-v*.*.*` tag between `39` merging and `01` merging, the `publish-tools.yml` workflow publishes `@media-tools/tools` to npm. That's an intermediate name and probably not what the user wants. **Document this risk in your PR description** and recommend the user wait until after `01` ships before tagging a release.

---

## Verification checklist

- [ ] Worktree created at `.claude/worktrees/39_shared-to-tools-rename/`
- [ ] Manifest row updated to `in-progress`
- [ ] `packages/shared/` no longer exists; `packages/tools/` exists with the same contents
- [ ] `packages/tools/package.json#name` is `@media-tools/tools` (worker 01 changes to `@mux-magic/tools` later)
- [ ] Reusable utilities from `packages/server/src/tools/` selectively moved into `packages/tools/src/` per criteria (with their tests)
- [ ] All imports updated; no `@media-tools/shared` references remain in `**/*.{ts,tsx,mjs,cjs,js,json,yml,yaml}` (verify with `Grep`)
- [ ] `packages/tools/src/index.ts` is the only barrel file in the repo
- [ ] `.github/workflows/publish-shared.yml` renamed to `publish-tools.yml` (or left and PR explains why)
- [ ] [docs/agents/code-rules.md](../../docs/agents/code-rules.md) §9 updated to name `packages/tools/src/index.ts`
- [ ] `yarn install` re-run; `yarn.lock` updated
- [ ] `yarn lint` clean
- [ ] `yarn typecheck` clean across all workspaces
- [ ] `yarn test` all passing
- [ ] `yarn e2e` passing with your own PORT/WEB_PORT
- [ ] `yarn lint` re-run after typecheck/test/e2e changes
- [ ] PR opened against `feat/mux-magic-revamp`
- [ ] PR description: lists commit chunks, files moved with rationale per file, and the worker-01 coordination note
- [ ] Manifest row updated to `done`

---

## Out of scope

- The `@media-tools/*` → `@mux-magic/*` rebrand — that's worker `01`'s job. This worker leaves the scope at `@media-tools/tools` intentionally.
- Adding new exports beyond what currently exists in `packages/shared/src/` plus the selectively-moved utilities — keep the move purely structural.
- Refactoring the moved utilities — keep them byte-identical except for the path/import-statement updates. If a utility needs a refactor (e.g., to remove a server-runtime dependency so it CAN be moved), file a follow-up worker rather than mixing concerns.
- Gallery-Downloader consuming the new `@mux-magic/tools` — that's worker `1d`'s job (after worker 01 publishes `@mux-magic/tools` to npm).
- Renaming env vars (e.g., `MEDIA_TOOLS_API_URL`) — out of scope for this worker AND worker 01.
- Renaming the on-disk directory `d:\Projects\Personal\mux-magic\` — out of scope (user does this manually if they want).
