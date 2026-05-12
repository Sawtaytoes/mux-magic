# Worker 1b — media-sync-rename-to-gallery-downloader

**Model:** Sonnet · **Thinking:** ON · **Effort:** High
**Branch:** `feat/gallery-downloader-revamp/1b-rename` (in the media-sync repo)
**Worktree:** `D:\Projects\Personal\media-sync\.claude\worktrees\1b_rename\`
**Phase:** 1B cross-repo
**Depends on:** 01 (Mux-Magic rename complete — needed only because some references in media-sync mention `media-tools` and should now mention `Mux-Magic`)
**Parallel with:** 1e, 1f (which run in the Mux-Magic repo)

## Universal Rules (TL;DR)

Worktree-isolated **in the media-sync repo**. Random PORT/WEB_PORT for media-sync's own e2e (if any). Yarn only. See [media-sync's AGENTS.md](D:\Projects\Personal\media-sync\AGENTS.md) (if present; if not, document new conventions there as part of this worker).

## Your Mission

Rename the `media-sync` repo (at `D:\Projects\Personal\media-sync`) to **`Gallery-Downloader`** (user-facing) / `gallery-downloader` (lowercase for npm scope, package name, directory).

### Naming conventions (use exactly these forms)

| Context | Old | New |
|---|---|---|
| User-facing product name | `media-sync`, `Media-Sync` | **`Gallery-Downloader`** |
| Root `package.json#name` | `media-sync` | `gallery-downloader` |
| Workspace package names | `media-sync/*` workspaces (5 packages) | rename each (e.g., `sync-scheduler` → `gallery-scheduler` if it makes sense, OR keep workspace names focused on function: `gallery-downloader-scheduler`, etc.) |
| Repo name on disk | `D:\Projects\Personal\media-sync` | **Leave as-is.** User renames the directory manually. |
| GitHub repo name | `media-sync` | **Leave as-is.** User renames the repo manually. |
| Cross-repo references in media-sync | `media-tools`, `@media-tools/*` | `Mux-Magic`, `@mux-magic/*` |
| Env vars (e.g. `MEDIA_TOOLS_API_URL`) | (existing) | **Leave as-is.** Functional env vars are out of scope. |

### Workspace renames

`media-sync/packages/` contains 5 packages per prior exploration. Read each `package.json` and decide:
- Functional names (e.g. `sync-scheduler`) — keep the function in the new name (e.g., `scheduler` or `gallery-downloader-scheduler`).
- Brand-only names — replace `media-sync` → `gallery-downloader`.

Worker `1c` will THEN remove the scheduler entirely; don't worry about preserving scheduler-related names if they're going away.

### Commit chunks (suggested order)

1. `chore(rename): root package.json + all workspace package.json files`
2. `chore(rename): import paths across .ts/.tsx files`
3. `chore(rename): config files (vitest, biome, eslint, tsconfig)`
4. `chore(rename): README + docs`
5. `chore(rename): GitHub Actions workflows (if any)`
6. `chore(rename): cross-repo references — media-tools → Mux-Magic, @media-tools/* → @mux-magic/*`

After each: run media-sync's own gate (`yarn lint`, `yarn typecheck`, `yarn test`).

## Files (high-level inventory in the media-sync repo)

- `D:\Projects\Personal\media-sync\package.json` (root)
- `D:\Projects\Personal\media-sync\packages\*\package.json` (all 5)
- `D:\Projects\Personal\media-sync\packages\sync-anime-and-manga\src\mediaToolsApi.ts` (will be removed entirely by worker `1c`; for now, rename `mediaToolsApi` → `muxMagicApi` to match the Mux-Magic rebrand; the file will be deleted in 1c)
- All `.ts` / `.tsx` imports
- `D:\Projects\Personal\media-sync\README.md`
- Cross-repo references

### Files NOT to touch
- `node_modules/`, `yarn.lock` (regenerated)
- `.git/`
- Anything under `.claude/worktrees/`
- Env var **names**

## Verification checklist

- [ ] Worktree created in media-sync repo
- [ ] Manifest row → `in-progress` (in Mux-Magic's `docs/workers/README.md`)
- [ ] All 6 suggested commits landed
- [ ] No `media-sync` references remain (except branch/repo names)
- [ ] No `@media-tools/*` references remain (renamed to `@mux-magic/*`)
- [ ] media-sync's `yarn lint`, `yarn typecheck`, `yarn test` all pass
- [ ] PR opened in media-sync repo (target: `master` or its equivalent integration branch)
- [ ] Manifest row → `done`

## After this worker merges

- User actions: rename GitHub repo `media-sync` → `gallery-downloader`; rename local directory; update `D:\Projects\Personal\media-sync\` reference in any external scripts.
- Worker `1c` then runs to decouple scheduling.

## Out of scope

- Removing the scheduler (worker `1c`'s job)
- Adding HA inbound endpoint (worker `1c`)
- Consuming `@mux-magic/shared` (worker `1d`)
- Functional behavior changes
