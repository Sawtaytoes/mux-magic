# Worker 02 — npm-publish-key-setup

**Model:** Haiku · **Thinking:** OFF · **Effort:** Low
**Branch:** `feat/mux-magic-revamp/02-npm-publish-key-setup`
**Worktree:** `.claude/worktrees/02_npm-publish-key-setup/`
**Phase:** 0
**Depends on:** none
**Parallel with:** 01 03 04

---

## Universal Rules

1. **Branch & worktree — create them first**
   ```powershell
   git fetch origin
   git worktree add .claude/worktrees/02_npm-publish-key-setup -b feat/mux-magic-revamp/02-npm-publish-key-setup feat/mux-magic-revamp
   cd .claude/worktrees/02_npm-publish-key-setup
   ```

2. **Port + PID protocol** — see [04's prompt](04_worker-conventions-agents-md.md) or AGENTS.md.

3. **Pre-push gate:** `yarn lint → yarn typecheck → yarn test → (e2e if you touched runtime code) → yarn lint`.

4. **Commit-and-push as you go.** Update your row in [docs/workers/README.md](README.md) at start (`in-progress`) and end (`done`).

5. **Yarn only.** Never npm/npx.

---

## Your Mission

Update the npm publish workflow to publish the rebranded shared package as `@mux-magic/tools` instead of `@media-tools/shared`. This worker prepares the publish pipeline for the rebrand; worker `01` (which runs after this lands) does the actual package rename in `packages/shared/package.json`. After both ship, the user adds the `NPM_TOKEN` secret to GitHub Actions manually.

### Scope (3 files)

1. **[.github/workflows/publish-shared.yml](../../.github/workflows/publish-shared.yml)** — rename references:
   - Workflow `name:` line: `Publish @media-tools/shared` → `Publish @mux-magic/tools`
   - Comments referencing `@media-tools/shared` scope → `@mux-magic/tools`
   - `yarn workspace @media-tools/shared run build` → `yarn workspace @mux-magic/tools run build`
   - `yarn workspace @media-tools/shared npm publish ...` → `yarn workspace @mux-magic/tools npm publish ...`
   - Comment about media-sync consumer: keep the spirit but reflect the new architecture — media-sync (being renamed to `<media-sync-renamed>` by worker `1b`) will consume `@mux-magic/tools`. Use placeholder `<media-sync-renamed>` for the consumer name.

2. **Tag prefix** — currently `shared-v*.*.*`. This is package-agnostic; **leave it as-is**. Don't rename to `mux-magic-shared-v*.*.*` unless you have a specific reason and document it in your PR. Existing CI/scripts may key off the tag prefix.

3. **Documentation of `NPM_TOKEN` setup** — there is no project-level `CONTRIBUTING.md` or `README.md`. Add a new section to [AGENTS.md](../../AGENTS.md) near the bottom titled **"## npm Publishing"** documenting:

   ```markdown
   ## npm Publishing

   `@mux-magic/tools` is the only package published to npm (the public consumer surface
   for `<media-sync-renamed>` and other downstream tools).

   **One-time setup** (user does this manually):
   1. Generate an npm automation token from npmjs.com with publish access to the
      `@mux-magic` scope.
   2. Add it to GitHub Actions repo secrets as `NPM_TOKEN`.

   **Publishing a new version:**
   1. Bump version in `packages/shared/package.json`.
   2. Tag: `git tag shared-v<X.Y.Z>` (note: `shared-` prefix is package-agnostic).
   3. `git push --tags` — the `publish-shared.yml` workflow runs and publishes.

   **Verifying:**
   - `yarn info @mux-magic/tools` shows the latest version after publish completes.
   - `.github/workflows/publish-shared.yml` is the source of truth for the publish steps.
   ```

### Coordination with worker `01`

This worker (`02`) is intentionally **paired with `01`** (which does the actual package rename). The order matters:

- **Run `02` BEFORE `01`** (in the spawn ordering recommended by [docs/workers/README.md](README.md)). After `02` ships, `publish-shared.yml` references `@mux-magic/tools` but the actual package is still named `@media-tools/shared`. **Do not push a release tag during this gap** — it will fail. Worker `01` fills the gap by renaming the package in code.
- After `01` ships, the workflow + package + downstream all align.

If the user pushes a `shared-v*.*.*` tag between `02` merging and `01` merging, the workflow will fail because `yarn workspace @mux-magic/tools` won't resolve. Document this risk in your PR description.

## TDD steps

This is a config-only worker; there's nothing to TDD in application code. The "test" is:

1. Confirm the workflow YAML parses cleanly (`yarn run` or any lint that validates YAML, or just verify in GitHub's workflow editor preview).
2. Verify `yarn workspace @mux-magic/tools --version` will **fail until worker `01` lands** (this is expected — confirms the rename is wired through to the workspace resolver).
3. Run the full pre-push gate. `yarn typecheck` and `yarn test` should pass because the package internally is still `@media-tools/shared` until `01` runs.

## Files

- [.github/workflows/publish-shared.yml](../../.github/workflows/publish-shared.yml)
- [AGENTS.md](../../AGENTS.md) — add the new "## npm Publishing" section near the bottom

## Verification checklist

- [ ] Worktree created at `.claude/worktrees/02_npm-publish-key-setup/`
- [ ] Manifest row updated to `in-progress`
- [ ] `publish-shared.yml` references renamed (3+ string replacements)
- [ ] `AGENTS.md` has new `## npm Publishing` section
- [ ] PR description notes the post-merge gap: workflow references `@mux-magic/tools` but the actual package rename lands in worker `01`. No release tags should be pushed until both merge.
- [ ] `yarn lint` clean
- [ ] `yarn typecheck` clean
- [ ] `yarn test` all passing
- [ ] `yarn e2e` passing (sanity — should be unaffected by config changes)
- [ ] `yarn lint` re-run after typecheck/test/e2e changes
- [ ] PR opened against `feat/mux-magic-revamp`
- [ ] Manifest row updated to `done`

## Out of scope

- Adding the actual `NPM_TOKEN` secret value — the user does this manually after worker 02 + 01 both ship.
- Publishing a first release — that's a separate user action, not in this worker.
- Renaming the package in `packages/shared/package.json` — that's worker `01`'s job. If you touch that file in this worker, you'll merge-conflict with `01`.
- Setting up an alternate npm registry — the workflow already targets `https://registry.npmjs.org`.
- Renaming the tag prefix — keep `shared-v*.*.*`.
