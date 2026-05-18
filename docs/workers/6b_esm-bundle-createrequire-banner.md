# Worker 6b — `createRequire` banner on esbuild server bundles

**Model:** Haiku · **Thinking:** OFF · **Effort:** Low
**Branch:** `feat/mux-magic-revamp/6b-esm-bundle-createrequire-banner`
**Worktree:** `.claude/worktrees/6b_esm-bundle-createrequire-banner/`
**Phase:** 4
**Depends on:** — (urgent prod fix; independent of 2d / 29)
**Parallel with:** anything not touching the root `package.json` `build:*-bundle` scripts.

## Universal Rules (TL;DR)

Worktree-isolated. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint` plus a manual prod-bundle smoke test (build → run → spawn an ffmpeg job → verify no `Dynamic require of "child_process"` crash). Yarn only. Worker flips its own MANIFEST row at start (`in-progress`) and after merge (`done`).

## Your Mission

Prod is currently crashing at boot:

```
file:///app/packages/server/dist/server.mjs:11
  throw Error('Dynamic require of "' + x4 + '" is not supported');
Error: Dynamic require of "child_process" is not supported
    at node_modules/tree-kill/index.js
```

[tree-kill](https://www.npmjs.com/package/tree-kill) is a direct runtime dep ([packages/server/src/cli-spawn-operations/treeKillChild.ts](../../packages/server/src/cli-spawn-operations/treeKillChild.ts)) used to kill spawned ffmpeg / mkvtoolnix children when jobs cancel — 6 call sites. It's a CommonJS package and calls `require("child_process")` internally. The esbuild ESM bundle (`--format=esm --bundle --platform=node`) wraps it in a `__require()` shim that throws because Node ESM has no runtime `require`. This regressed in commit `9e3ecef2` (wrapper-tower collapse, 2026-05-18) when the bundle replaced direct `tsx` execution.

**Fix:** add an esbuild `--banner:js` that injects a real `createRequire`-backed `require` into the ESM output, so CJS deps that call `require()` for Node built-ins resolve at runtime.

## The change

In root [package.json](../../package.json), update `build:server-bundle` (and `build:web-server-bundle` while you're there — same class of bug latent there):

```jsonc
"build:server-bundle": "esbuild --format=esm --bundle --platform=node --banner:js=\"import{createRequire}from'node:module';const require=createRequire(import.meta.url);\" --external:./xhr-sync-worker.js \"--external:chromium-bidi/*\" --external:playwright --external:playwright-core --outfile=packages/server/dist/server.mjs packages/server/src/server.ts",
"build:web-server-bundle": "esbuild --format=esm --bundle --platform=node --banner:js=\"import{createRequire}from'node:module';const require=createRequire(import.meta.url);\" --outfile=packages/web/dist-server/server.mjs packages/web/src/server.ts",
```

The banner string is:

```js
import{createRequire}from'node:module';const require=createRequire(import.meta.url);
```

This shadows esbuild's broken `__require` stub with a real `require` for every CJS dep in the bundle that calls it.

> **Note:** worker 29 deletes `build:web-server-bundle` and rewrites `build:server-bundle` for a new package layout. This fix lands now to unblock prod; worker 29's rewritten bundle command MUST carry the same banner forward. A coordination line is added to worker 29's doc.

## Tests

- **Manual prod smoke test (required before merge):**
  1. `yarn build:prod`
  2. `node packages/server/dist/server.mjs` — should boot without the `Dynamic require` crash.
  3. POST a sequence that spawns ffmpeg (or any spawn-op) and then cancel it via `DELETE /jobs/:id`. Verify the ffmpeg child is killed cleanly (no orphaned process; logs show `[treeKillChild]` activity).
- Unit tests: none required — the change is a build-script flag, not source. Existing tests don't exercise the bundle.
- **Vitest** still runs source via vitest's own loader (not the esbuild bundle), so test coverage isn't affected.

## Files

- [package.json](../../package.json) — two `build:*-bundle` scripts get the banner flag.

## Suggested commit order

```text
1. chore(manifest): worker 6b in-progress
2. fix(build): add createRequire banner to esbuild server bundles
3. chore(manifest): worker 6b done
```

## Out of scope

- Rewriting `tree-kill` to ESM, replacing with a different process-killer, or pre-bundling node_modules differently. The banner is the canonical fix.
- The bundle script restructuring worker 29 introduces — that worker carries the banner forward; this worker just unblocks prod immediately.
- Other latent CJS-require-in-ESM-bundle bugs from different deps. If the smoke test surfaces additional crashes, file follow-up workers per dep; do not chase them in 6b.

## Why this exists

Prod is down. The fix is one flag. This worker exists to land that flag fast without entangling it in 2d's / 29's larger refactors. A new worker (rather than folding into 29) so the prod-restore PR can ship today instead of waiting for the architectural changes to land.
