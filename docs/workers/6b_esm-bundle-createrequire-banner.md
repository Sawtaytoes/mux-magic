# Worker 6b — bundle ergonomics: banner + sourcemaps + tools publish form

**Model:** Haiku · **Thinking:** OFF · **Effort:** Low
**Branch:** `feat/mux-magic-revamp/6b-esm-bundle-createrequire-banner`
**Worktree:** `.claude/worktrees/6b_esm-bundle-createrequire-banner/`
**Phase:** 4
**Depends on:** — (urgent prod fix + low-risk hygiene bundle; independent of 2d / 29 / 6c)
**Parallel with:** anything not touching root `package.json` `build:*-bundle` scripts, `packages/tools/package.json`, or `scripts/start-prod.cjs`.

> **History note.** Filename slug names only the `createRequire` banner because that was the original urgent prod fix. Scope was extended in the same session that filed it to cover two related build/publish hygiene fixes that are cheap to bundle in one PR. Filename stays per the "never re-slug" rule; this title is the real scope.

## Universal Rules (TL;DR)

Worktree-isolated. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint` plus a manual prod-bundle smoke test (build → run → spawn an ffmpeg job → verify no `Dynamic require of "child_process"` crash). Yarn only. Worker flips its own MANIFEST row at start (`in-progress`) and after merge (`done`).

## Your Mission

Three coordinated low-risk fixes to the build and publish surface. Each is independently small; bundling them in one PR avoids three round-trips through CI and the cherry-pick-to-master dance.

1. **`createRequire` banner** on esbuild ESM server bundles — fixes a boot crash on prod (`Dynamic require of "child_process" is not supported` from `tree-kill`).
2. **External sourcemaps + `--enable-source-maps`** — restores readable stack traces from prod. Without this every stack trace points at line numbers in the minified-ish bundle (`server.mjs:194963:32`) instead of original `.ts` source.
3. **`@mux-magic/tools` publishes compiled JS** (not raw `.ts` source) — version bump `1.1.0` → `1.2.0` so gallery-downloader (the external consumer) gets a runnable artifact.

---

### Part 1 — the `createRequire` banner (prod-down fix)

Prod is crashing at boot:

```text
file:///app/packages/server/dist/server.mjs:11
  throw Error('Dynamic require of "' + x4 + '" is not supported');
Error: Dynamic require of "child_process" is not supported
    at node_modules/tree-kill/index.js
```

[tree-kill](https://www.npmjs.com/package/tree-kill) is a direct runtime dep ([packages/server/src/cli-spawn-operations/treeKillChild.ts](../../packages/server/src/cli-spawn-operations/treeKillChild.ts)) used to kill spawned ffmpeg / mkvtoolnix children when jobs cancel — 6 call sites. It's a CommonJS package and calls `require("child_process")` internally. The esbuild ESM bundle (`--format=esm --bundle --platform=node`) wraps it in a `__require()` shim that throws because Node ESM has no runtime `require`. Regressed in commit `9e3ecef2` (wrapper-tower collapse) when the bundle replaced direct `tsx` execution.

**Fix:** add an esbuild `--banner:js` that injects a real `createRequire`-backed `require` into the ESM output, so CJS deps that call `require()` for Node built-ins resolve at runtime.

In root [package.json](../../package.json), update both `build:*-bundle` scripts:

```jsonc
"build:server-bundle":     "esbuild ... \"--banner:js=import{createRequire}from'node:module';const require=createRequire(import.meta.url);\" ...",
"build:web-server-bundle": "esbuild ... \"--banner:js=import{createRequire}from'node:module';const require=createRequire(import.meta.url);\" ...",
```

Quoting: yarn 4's `@yarnpkg/shell` (used on all platforms) treats `;` outside quotes as a statement separator. The banner contains semicolons and single quotes, so the whole `--banner:js=...` flag must be wrapped in shell double quotes (`\"...\"` after JSON escaping, mirroring the existing `\"--external:chromium-bidi/*\"` pattern in the same script).

> **Worker 29 carry-forward:** when worker 29 rewrites the bundle command for the new `packages/server/` package, the banner MUST come with it. Without it the new bundle re-introduces this crash the moment a job cancellation triggers `treeKillChild`. Already flagged in worker 29's Phase G.

---

### Part 2 — external sourcemaps + `--enable-source-maps`

Two coupled changes:

#### 2a. Emit sourcemaps from esbuild

Add `--sourcemap` (external, default behavior — produces `*.mjs.map` alongside each `*.mjs`) to both bundle scripts:

```jsonc
"build:server-bundle":     "esbuild ... --sourcemap ... packages/server/src/server.ts",
"build:web-server-bundle": "esbuild ... --sourcemap ... packages/web/src/server.ts",
```

External (default) over inline because:
- The bundle file itself stays small for cold-start parse time.
- The `.map` only loads when a stack trace is being rewritten (i.e. on errors).
- Production stack traces stay readable but parsing of the hot code path isn't penalized.

#### 2b. Tell Node to read them at runtime

The bundle ships next to its `.map` file, but V8 only consults the map if Node was started with `--enable-source-maps`. Add the flag to both spawn calls in [scripts/start-prod.cjs](../../scripts/start-prod.cjs):

```js
const apiProc = spawn(
  process.execPath,
  ["--enable-source-maps", "packages/server/dist/server.mjs"],
  { cwd: repoRoot, stdio: "inherit" },
)
// ... and the same flag on webProc
```

> **Why not in `prod:api-server` / `prod:web-server`?** Those scripts run `tsx src/server.ts` (TypeScript source via tsx loader), not the bundle. tsx has its own sourcemap pathway and doesn't need `--enable-source-maps`. The flag matters only for plain-Node-against-the-bundle, which is what `start-prod.cjs` (the Dockerfile CMD path) does.

> **Worker 29 carry-forward:** when worker 29 deletes `start-prod.cjs` and switches the Dockerfile `CMD` to `["node", "packages/server/dist/index.js"]` directly, the CMD becomes `["node", "--enable-source-maps", "packages/server/dist/index.js"]`. Worker 29's Phase G also covers this.

---

### Part 3 — `@mux-magic/tools` ships compiled JS (publish-form fix)

Today [packages/tools/package.json](../../packages/tools/package.json) v1.1.0 is published to npm as **raw TypeScript source**:

| Field | Before | After |
|---|---|---|
| `main` | `./src/index.ts` | `./dist/index.js` |
| `types` | `./src/index.ts` | `./dist/index.d.ts` |
| `exports['.']` | `{ types, default }` → `./src/index.ts` | `{ source: "./src/index.ts", types: "./dist/index.d.ts", default: "./dist/index.js" }` |
| `files` | `["src"]` | `["dist", "src"]` |
| `scripts` | (no prepack) | `"prepack": "yarn build"` |
| `version` | `1.1.0` | `1.2.0` |

The `tsconfig.build.json` ([packages/tools/tsconfig.build.json](../../packages/tools/tsconfig.build.json)) was already correctly configured — `outDir: "dist"`, `declaration: true`, `declarationMap: true`, `sourceMap: true`. The `build` script (`tsc -p tsconfig.build.json`) runs cleanly and produces `dist/*.{js,d.ts,js.map,d.ts.map}`. The bug was simply that the package manifest never referenced `dist/` and `prepack` wasn't wired up.

#### Why the change is non-breaking

- **External consumers** (gallery-downloader's five packages) all use the bare `import { ... } from "@mux-magic/tools"`. Today that resolves to `src/index.ts` (which fails under plain Node); after the fix it resolves to `dist/index.js` (runnable everywhere). **Strict improvement.**
- **Internal mux-magic workspace consumers** use deep imports like `@mux-magic/tools/src/logMessage.js`. The `"./src/*": "./src/*"` mapping in `exports` stays, so those keep working in dev (TS resolution finds `.ts` via NodeNext's `.js` → `.ts` rewriting).

#### Semver call

`1.2.0` (minor) — adds a runnable publish form; preserves all existing import surfaces. Patch (`1.1.1`) understates the change; major (`2.0.0`) overstates it.

#### The `source` condition

Adding `source: "./src/index.ts"` to `exports['.']` lets bundlers that understand the `source` condition (Vite, esbuild via custom resolvers) resolve back to TypeScript source for HMR / inline type narrowing in mux-magic's own workspaces. Plain Node ignores `source` and falls through to `default: "./dist/index.js"`. **Both worlds satisfied.**

#### Publish path

The existing `.github/workflows/publish-shared.yml` (created by worker 02, updated by worker 39) already runs `yarn workspace @mux-magic/tools npm publish` on `shared-v*.*.*` tags. After this worker merges:

1. Verify `yarn workspace @mux-magic/tools build` produces `dist/` (it does — manually verified in the worker session that filed this).
2. Tag: `git tag shared-v1.2.0 && git push origin shared-v1.2.0`.
3. The workflow runs, `prepack` rebuilds `dist/` (so the published tarball is always fresh), and `dist/` ships to npm via the `files: ["dist", "src"]` allowlist.
4. **Follow-up coordination:** open a PR in gallery-downloader to bump `@mux-magic/tools: ^1.1.0` → `^1.2.0` across all five workspace packages. Verify gallery-downloader's container still boots — it should be strictly better since the dep now resolves to runnable JS.

---

## Tests / verification

- **Build:** `yarn build:prod` produces `packages/server/dist/server.mjs` + `.mjs.map` + `packages/web/dist-server/server.mjs` + `.mjs.map`. No warnings about unresolvable `child_process`.
- **Boot:** `node scripts/start-prod.cjs` brings both processes up without the `Dynamic require` crash.
- **Sourcemap proof:** intentionally throw from somewhere in `packages/server/src/`, rebuild, run — stack trace should reference the `.ts` file path with the right line number, not `server.mjs:NNNN`.
- **Job cancellation:** POST a sequence that spawns ffmpeg, then `DELETE /jobs/:id`. Verify the ffmpeg child is killed cleanly (logs show `[treeKillChild]`).
- **Tools build:** `yarn workspace @mux-magic/tools build` materializes `dist/index.js` and `dist/index.d.ts`. `node -e "import('@mux-magic/tools').then(m => console.log(Object.keys(m)))"` from the repo root prints the named exports.
- Unit tests: none required — all three changes are build-script flags + a `package.json` shape edit. Existing tests don't exercise the bundle or the published manifest.

## Files

- [package.json](../../package.json) — `--sourcemap` + banner on both `build:*-bundle` scripts.
- [scripts/start-prod.cjs](../../scripts/start-prod.cjs) — `--enable-source-maps` on both spawn arg-arrays.
- [packages/tools/package.json](../../packages/tools/package.json) — `main`, `types`, `exports['.']`, `files`, `scripts.prepack`, `version`.

## Suggested commit order

```text
1. chore(manifest): worker 6b in-progress
2. fix(build): add createRequire banner to esbuild ESM server bundles
3. fix(build): emit sourcemaps + --enable-source-maps for prod bundles
4. chore(tools): publish compiled JS + bump @mux-magic/tools to 1.2.0
5. chore(manifest): worker 6b done
6. (after merge to master) tag shared-v1.2.0 and let publish-shared.yml run
7. (follow-up) gallery-downloader PR: bump @mux-magic/tools ^1.1.0 → ^1.2.0
```

## Out of scope

- Rewriting `tree-kill` to ESM or replacing it. The banner is the canonical fix.
- Bundle-size optimization (tree-shaking audit, etc.) — different concern, different worker.
- Restructuring `@mux-magic/tools` to drop `src/` from the published tarball. Internal workspaces still deep-import from `src/`; cleaning that up means rewriting ~50 call sites and is a separate refactor worth its own worker if anyone cares.
- The multi-stage Dockerfile refactor (worker 6c).
- The package split (`server` → `core` + `api`) and the front-door rewrite (worker 2d / 29).

## Why this exists

Three small fixes that all touch the build + publish surface, all ship cheaply together, all unblock something downstream (prod restoration, stack-trace debuggability, gallery-downloader's external consumption). Bundling them in one worker avoids three PRs through the same review cycle and keeps the related changes in one logical commit cluster the reviewer can read top-to-bottom.
