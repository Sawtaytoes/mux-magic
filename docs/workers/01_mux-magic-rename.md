# Worker 01 — mux-magic-rename

**Model:** Sonnet · **Thinking:** ON · **Effort:** High
**Branch:** `feat/mux-magic-revamp/01-mux-magic-rename`
**Worktree:** `.claude/worktrees/01_mux-magic-rename/`
**Phase:** 0
**Depends on:** Workers 02, 03, 04 should land first to avoid conflicts on overlapping files (AGENTS.md, publish-shared.yml, storybook configs)
**Parallel with:** Not recommended — coordinates with 02/03/04 via merge order, not parallelism

This is the **rebrand worker**. After it ships, the project is officially named **Mux-Magic** (with hyphen) and all `@media-tools/*` npm scopes are renamed to `@mux-magic/*`. The work is broad but mechanical.

---

## Universal Rules

1. **Branch & worktree — create AFTER 02, 03, 04 have merged**
   ```powershell
   git fetch origin
   git checkout feat/mux-magic-revamp
   git pull
   # Verify 02, 03, 04 have merged into feat/mux-magic-revamp:
   git log --oneline feat/mux-magic-revamp | findstr /R "02-npm 03-storybook 04-worker"
   # All three commits should appear. If not, wait for them to merge first.
   git worktree add .claude/worktrees/01_mux-magic-rename -b feat/mux-magic-revamp/01-mux-magic-rename feat/mux-magic-revamp
   cd .claude/worktrees/01_mux-magic-rename
   ```

2. **Port + PID protocol** — see `AGENTS.md` "Worker port/PID protocol" section (added by worker 04).

3. **Pre-push gate:** `yarn lint → yarn typecheck → yarn test → yarn e2e → yarn lint`. The rename touches enough surface area that **all five gates must pass**.

4. **TDD:** for a rename, the "test" is `yarn typecheck` + `yarn test` passing. If you discover broken behavior caused by a missed rename, write a test that catches the specific broken case before fixing.

5. **Commit-and-push as you go.** Break the rename into logical chunks (see "Suggested commit order" below). Update your row in [docs/workers/README.md](README.md).

6. **Yarn only.** Never npm/npx.

---

## Your Mission

Rename the project from `media-tools` (current) to **`Mux-Magic`** (user-facing) and `@mux-magic` (npm scope). The rebrand is purely cosmetic — no behavior changes, no API contract changes, no schema migrations. Workers downstream depend on the new names being stable.

### Naming conventions (use exactly these forms)

| Context | Old | New |
|---|---|---|
| User-facing product name (README, docs, comments) | `media-tools`, `Media-Tools`, `MediaTools` | **`Mux-Magic`** |
| npm scope | `@media-tools/...` | `@mux-magic/...` |
| Workspace package names | `@media-tools/server`, `@media-tools/web`, `@media-tools/shared` | `@mux-magic/server`, `@mux-magic/web`, `@mux-magic/shared` |
| Root `package.json#name` | `media-tools` | `mux-magic` |
| Directory name on disk | `d:\Projects\Personal\media-tools\` | **Leave as-is.** The user renames the directory manually (not in scope for this worker). |
| GitHub repo name | `media-tools` | **Leave as-is.** The user renames the repo manually. |
| Env var names (e.g. `MEDIA_TOOLS_API_URL`) | (existing) | **Leave as-is.** Env vars are out of scope — the user can rename them later if desired. |
| Comments referencing "the media-tools repo" or "this monorepo" | (existing) | **`Mux-Magic`** |
| API operationIds, internal IDs, route paths | (existing) | **Leave as-is.** Public API contract. |

If you encounter a string that's ambiguous (e.g., a literal string `"media-tools"` in test data), surface it in your PR for the user to decide rather than guessing.

---

## Suggested commit order (one logical group per commit)

1. **`chore(rename): workspace package names`** — rename `name` fields in:
   - [packages/server/package.json](../../packages/server/package.json) → `@mux-magic/server`
   - [packages/web/package.json](../../packages/web/package.json) → `@mux-magic/web`
   - [packages/shared/package.json](../../packages/shared/package.json) → `@mux-magic/shared`
   - Also update cross-package dependencies: any `dependencies` / `devDependencies` block referencing the old names.
   - Root [package.json](../../package.json) — rename `name: "media-tools"` → `"mux-magic"`; rename any internal devDependency `"@media-tools/web": "workspace:*"` → `"@mux-magic/web": "workspace:*"`.
   - Run `yarn install` to refresh `yarn.lock` after these changes.

2. **`chore(rename): @media-tools imports → @mux-magic`** — repo-wide replace of `@media-tools/server`, `@media-tools/web`, `@media-tools/shared` in all `.ts`, `.tsx`, `.mjs`, `.cjs`, `.js` files. Use Grep first to count occurrences and confirm the scope; then apply with `Edit --replace_all` per file (or scripted sed-equivalent).

3. **`chore(rename): scripts referencing @media-tools workspaces`** — root and per-package `package.json#scripts` may reference `yarn workspace @media-tools/...`. Rename to `@mux-magic/...`. Per [feedback_rename_strategy.md](C:\Users\satur\.claude\projects\d--Projects-Personal-media-tools\memory\feedback_rename_strategy.md): pick `replace_all` per file for high-density renames; `grep-then-rename` only if blast radius is small.

4. **`chore(rename): GitHub Actions workflows`** — [.github/workflows/](../../.github/workflows/) (excluding `publish-shared.yml` which worker 02 already handled):
   - `ci.yml`, `deploy.yml`, and any others
   - Look for hardcoded `@media-tools/...` references, image tags (`ghcr.io/sawtaytoes/media-tools:latest` → `ghcr.io/sawtaytoes/mux-magic:latest` — verify the GHCR namespace with the user before pushing; if uncertain, ASK rather than guess)

5. **`chore(rename): user-facing docs`** — README files, all `.md` in `docs/` (EXCEPT `docs/archive/` and `docs/react-migration-prompts/` — those are historical and stay as-written):
   - Update product name strings (`media-tools` → `Mux-Magic`)
   - Update example commands referencing `@media-tools/...`
   - **Skip** `docs/workers/` — those prompts were written using new names already

6. **`chore(rename): AGENTS.md and code comments`** — [AGENTS.md](../../AGENTS.md) text references + inline code comments. Use Grep to find `media-tools` / `Media-Tools` in `.ts`, `.tsx`, `.md` (excluding the directories noted above) and update.

7. **`chore(rename): assets and config files`** — any other config files (`biome.json`, `eslint.config.js`, `vitest.config.ts`, `playwright.config.ts`, `tsconfig.json`, `tsconfig.*.json`) referencing the old name.

After each commit: run `yarn lint → typecheck → test`. If a commit breaks these, do not push — fix in a follow-up commit before pushing the chunk.

---

## Files (high-level inventory; not exhaustive — use Grep)

Critical-blast-radius files (touch carefully, one per commit):
- [package.json](../../package.json) (root)
- [packages/server/package.json](../../packages/server/package.json)
- [packages/web/package.json](../../packages/web/package.json)
- [packages/shared/package.json](../../packages/shared/package.json)
- [yarn.lock](../../yarn.lock) (regenerated by `yarn install`)
- [AGENTS.md](../../AGENTS.md)
- [.github/workflows/ci.yml](../../.github/workflows/ci.yml)
- [.github/workflows/deploy.yml](../../.github/workflows/deploy.yml)

Pattern files (likely many; use `Grep` for exact list):
- All `**/*.{ts,tsx,mjs,cjs,js}` containing `@media-tools/` or `media-tools` or `MEDIA_TOOLS` or `MediaTools`
- All `**/*.md` outside `docs/archive/` and `docs/react-migration-prompts/`

### Files NOT to touch
- [docs/archive/](../../docs/archive/) — historical records
- [docs/react-migration-prompts/](../../docs/react-migration-prompts/) — historical worker prompts
- [docs/w8-bug-fix-wave.md](../../docs/w8-bug-fix-wave.md) and [docs/workers/w8*.md](../../docs/workers/) (existing w8/w9 prompts) — historical
- `node_modules/`
- Anything under `.claude/worktrees/` (other workers in flight)
- Env var **names** — leave `MEDIA_TOOLS_API_URL` etc. unchanged unless explicitly asked
- Public API contract — route paths, operationIds, schema field names

---

## Rename strategy

Per [feedback_rename_strategy.md](C:\Users\satur\.claude\projects\d--Projects-Personal-media-tools\memory\feedback_rename_strategy.md):
- High-density file (many occurrences of the same string) → `Edit --replace_all` per file
- Low-density (one or two occurrences across many files) → Grep-then-rename
- Be careful with ESLint naming-convention rules: they catch **declarations**, not **references**. A file with 100 references and 1 declaration will fail lint if you miss the declaration.

For each rename pass:
1. Run `Grep` to enumerate match files.
2. If <10 files: open each, Edit with replace_all.
3. If 10+ files: script a multi-Edit pass.
4. Run `yarn lint --fix` to catch any lint regressions from naming.
5. Run `yarn typecheck` to catch any broken imports.

---

## Verification checklist

- [ ] Worker 02 ✅, Worker 03 ✅, Worker 04 ✅ merged into `feat/mux-magic-revamp` before this worker starts
- [ ] Worktree created at `.claude/worktrees/01_mux-magic-rename/`
- [ ] Manifest row updated to `in-progress`
- [ ] All 7 suggested commits landed (or merged into fewer commits with clear messages)
- [ ] `yarn install` re-run after package.json renames; `yarn.lock` updated
- [ ] No `@media-tools/` references remain in `**/*.{ts,tsx,mjs,cjs,js,json,yml,yaml}` (verify with `Grep`)
- [ ] No `media-tools` user-facing references remain in `**/*.md` outside the noted historical directories (verify with `Grep` — note: the WORD "media" elsewhere is fine; just check `media-tools` and `Media-Tools`)
- [ ] `yarn lint` clean
- [ ] `yarn typecheck` clean across all workspaces
- [ ] `yarn test` all passing
- [ ] `yarn e2e` passing with your own PORT/WEB_PORT
- [ ] `yarn lint` re-run after typecheck/test/e2e changes
- [ ] PR opened against `feat/mux-magic-revamp`
- [ ] PR description lists the 7 commit chunks + any ambiguous strings flagged for the user
- [ ] Manifest row updated to `done`

---

## After this worker merges

- **User actions (manual, not part of this worker):**
  - Rename the GitHub repo from `media-tools` to `mux-magic` (or keep as-is — user's call)
  - Rename the local directory `d:\Projects\Personal\media-tools\` → `d:\Projects\Personal\mux-magic\` (user's call)
  - Add `NPM_TOKEN` secret to GitHub Actions if not already done (worker 02 documented this)
  - Tag a release: `git tag shared-v<X.Y.Z>` → triggers `publish-shared.yml` to publish `@mux-magic/shared` to npm
- **Then the integration branch can merge to master**, completing Phase 0.
- **Then Phase 1A workers spawn** (`05 → 06 → 07` serial chain on `eslint.config.js`).

---

## Out of scope

- Directory rename on disk (user does this)
- GitHub repo rename (user does this)
- Renaming `MEDIA_TOOLS_API_URL` / other env var names (deferred — separate concern from branding)
- Renaming the package in [.github/workflows/publish-shared.yml](../../.github/workflows/publish-shared.yml) (already done by worker 02)
- Renaming worker prompt files in `docs/workers/` (they're already on the new naming scheme)
- Changing API route paths, operationIds, or schema field names (public API contract)
- Adding any new feature or behavior change
