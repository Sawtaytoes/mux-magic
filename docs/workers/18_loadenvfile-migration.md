# Worker 18 — loadenvfile-migration

**Model:** Haiku · **Thinking:** OFF · **Effort:** Low
**Branch:** `feat/mux-magic-revamp/18-loadenvfile-migration`
**Worktree:** `.claude/worktrees/18_loadenvfile-migration/`
**Phase:** 1B other
**Depends on:** 01
**Parallel with:** all other 1B workers (but **coordinates with worker 01** on `package.json` edits)

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your Mission

Replace `tsx --env-file=...` flag usage in package.json scripts with `process.loadEnvFile()`. Node 22+ supports this natively, so we drop the `tsx` flag for env loading (we still use `tsx` for TypeScript execution).

### Current state

Two files use the flag:
- [packages/server/package.json](../../packages/server/package.json)
- [packages/web/package.json](../../packages/web/package.json)

[e2e/playwright.setup.ts](../../e2e/playwright.setup.ts) already uses `process.loadEnvFile()`. Mirror that pattern.

### Migration

For each script using `tsx --env-file=.env <entry>.ts`:
1. Change the script to just `tsx <entry>.ts`.
2. At the top of the entry file (e.g., the server's main `index.ts`, the CLI's `cli.ts`), add:
   ```ts
   process.loadEnvFile()
   ```
   This must be called BEFORE any import that reads env vars (i.e., at the very top, before other module-level code).
3. Verify env vars are still loaded by running the script with a known `.env` file.

### Watch-outs

- `process.loadEnvFile()` is a synchronous file read; throws if the file doesn't exist. The function signature is `loadEnvFile(path?: string)`; default path is `./.env` relative to the working directory.
- If `.env` is OPTIONAL (e.g., production runs without one), wrap the call: `try { process.loadEnvFile() } catch {}`.
- Multiple `.env` files (e.g., `.env.local`, `.env.production`): call `loadEnvFile` for each — order matters for overrides.

## TDD steps

1. Identify entry files for each script (read package.json scripts).
2. Add `process.loadEnvFile()` to each entry file.
3. Update the scripts.
4. Run each affected command and verify env vars are loaded.
5. `yarn typecheck` + `yarn test` + `yarn e2e` clean.

## Files

- [packages/server/package.json](../../packages/server/package.json)
- [packages/web/package.json](../../packages/web/package.json)
- Server entry files (find via grep — the scripts will name them)
- Possibly the CLI entry [packages/server/src/cli.ts](../../packages/server/src/cli.ts)

## Verification checklist

- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] No `tsx --env-file=` in package.json scripts (grep clean)
- [ ] All entry files have `process.loadEnvFile()` at top
- [ ] Optional-env paths wrapped in try/catch where appropriate
- [ ] `yarn dev:api-server` starts with env loaded
- [ ] `yarn dev:web-server` starts with env loaded
- [ ] `yarn e2e` passes
- [ ] Standard gate clean
- [ ] PR opened
- [ ] Manifest row → `done`

## Out of scope

- Adding new env vars
- Migrating env loading in shell-level invocations
- Changing the `.env.example` template
