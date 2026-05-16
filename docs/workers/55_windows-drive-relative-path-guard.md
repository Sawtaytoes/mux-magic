# Worker 55 — windows-drive-relative-path-guard

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/55-windows-drive-relative-path-guard`
**Worktree:** `.claude/worktrees/55_windows-drive-relative-path-guard/`
**Phase:** 4
**Depends on:** —
**Parallel with:** any worker that doesn't touch [packages/server/src/tools/pathSafety.ts](../../packages/server/src/tools/pathSafety.ts) or its callers.

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your Mission

On Windows, `path.isAbsolute("/work")` returns `true` and `fs.mkdirSync("/work")` silently creates `D:\work` (the OS prepends the CWD's drive letter). The repo treats POSIX-style paths as "absolute" in fixtures and yaml, but at the syscall layer on Windows they're **drive-relative** and quietly anchored to whatever drive the dev server happens to be running from.

The user observed this when their `D:\` drive sprouted folders matching test-fixture names (`work`, `media`, `seq-root`, `top-level-check`, etc.) plus repeated `[listDirectoryEntries] ENOENT … 'D:\home'` lines in the dev-server log. The mechanism:

1. The web UI sent `{ path: "/home" }` to `POST /queries/listDirectoryEntries`.
2. The server called `fs.readdir("/home")` → Node resolved it to `D:\home` → ENOENT.
3. Same code path with a `makeDirectory` step using `sourcePath: "/work"` would **succeed**, silently creating `D:\work` on the host.

The existing [validateReadablePath](../../packages/server/src/tools/pathSafety.ts#L26) uses `isAbsolute(path)` as its gate — which on Windows lets `/work` through, because `isAbsolute("/work") === true` there. That's the gap we need to close.

### What to add

Extend `pathSafety.ts` with a Windows-only check that rejects drive-relative paths at the API boundary, with a useful error message telling the operator exactly how to migrate.

The detection uses `path.parse`:

```ts
// On Windows:
//   parse("/work")             → { root: "/",       … }   ← drive-relative
//   parse("C:\\work")          → { root: "C:\\",    … }   ← fully qualified
//   parse("\\\\server\\share") → { root: "\\\\server\\share\\", … }  ← UNC
//
// On POSIX:
//   parse("/work")             → { root: "/",       … }   ← genuinely absolute
//
// Gate the check on `process.platform === "win32"` so Linux/macOS deploys are
// unaffected.
const isDriveRelativeWindowsPath = (p: string): boolean =>
  process.platform === "win32" && parse(p).root === "/"
```

Wire that into `validateReadablePath` (which `validateMediaPath` already wraps) so every endpoint that funnels through path safety gets the protection automatically.

### Error message

The error needs to tell the operator **why** their path is rejected and **what to type instead**. The current CWD's drive letter is the cheapest hint:

```
PathSafetyError: Path "/work" is drive-relative on Windows — it would
silently anchor to "D:" (the dev server's current drive). Use a fully
qualified path like "D:\\work" or a UNC share like "\\\\server\\share\\work".
```

(Include both the input path and the inferred drive prefix in the message so the operator can copy/paste a fix.)

### Where it fires

`validateReadablePath` is already the choke point for the file-explorer endpoints. Audit the callers and confirm:

- [packages/server/src/api/routes/fileRoutes.ts](../../packages/server/src/api/routes/fileRoutes.ts) — list/stream/delete entry points (the source of the `ENOENT 'D:\home'` log line).
- [packages/server/src/api/routes/queryRoutes.ts](../../packages/server/src/api/routes/queryRoutes.ts) — `listDirectoryEntries`, `getDefaultPath`, etc.
- Any sequence/command dispatch that takes `sourcePath` / `destinationPath` / `paths.*.value` and does not currently go through path safety — gap-fill at the API boundary (NOT inside individual command handlers, which run in memfs under test).

If you find a code path that takes a path from the client and never calls `validateReadablePath`, add the call at the route handler — that's the API boundary the docs describe.

### What stays unaffected

- **Linux / macOS deploys.** The check is `process.platform === "win32"` only; on POSIX hosts it's a no-op and `/work` stays a legitimate absolute path.
- **Tests.** The vitest setups in `packages/server` and `packages/tools` mock `node:fs` to memfs, which is POSIX-style and runs in-process — drive resolution never happens. Tests using `/work`, `/seq-root`, etc. keep working unchanged. **However**, the new guard MUST be unit-tested with `process.platform` stubbed to `"win32"` so the rejection logic is exercised on every CI host (Linux runners included).
- **UNC paths and `C:\…` style fully-qualified paths.** These pass cleanly because `parse(p).root` returns the UNC root or the drive root, not `"/"`.

## Tests (per test-coverage discipline)

Pure unit tests against an extracted `assertNotDriveRelative(path)` (or whatever you want to call the new helper) — keep it pure and platform-injectable so the test doesn't depend on the runner's actual OS:

- `platform="win32"`, `path="/work"` → throws `PathSafetyError`, message contains `"D:"` (or whatever the injected CWD drive is) and contains `"/work"`.
- `platform="win32"`, `path="C:\\work"` → does not throw.
- `platform="win32"`, `path="\\\\server\\share\\dir"` → does not throw.
- `platform="linux"`, `path="/work"` → does not throw.
- `platform="darwin"`, `path="/work"` → does not throw.

Plus an integration test on `validateReadablePath` itself confirming the new check fires for `/work` under Windows and is skipped under Linux.

## TDD steps

1. **Red.** Add `pathSafety.driveRelative.test.ts` next to `pathSafety.ts` with the cases above. Commit `test(server): failing tests for Windows drive-relative path rejection`.
2. **Green.** Extract `assertNotDriveRelative` (pure, platform + cwd injectable) and call it from `validateReadablePath` after the existing `isAbsolute` gate. Commit.
3. **Audit.** Grep the server for path-taking route handlers; confirm each calls `validateReadablePath`. If any skip it, add the call. Commit per file.
4. **Manifest.** Dedicated `chore(manifest):` flip commits for `in-progress` and `done`.

## Files

- [packages/server/src/tools/pathSafety.ts](../../packages/server/src/tools/pathSafety.ts) — add `assertNotDriveRelative` + wire it into `validateReadablePath`.
- `packages/server/src/tools/pathSafety.driveRelative.test.ts` — new.
- [packages/server/src/api/routes/fileRoutes.ts](../../packages/server/src/api/routes/fileRoutes.ts) — audit; add `validateReadablePath` call if any handler skips it.
- [packages/server/src/api/routes/queryRoutes.ts](../../packages/server/src/api/routes/queryRoutes.ts) — audit; same.
- Other route files surfaced by the audit — gap-fill at the boundary.

## Out of scope

- **Reshaping `validateMediaPath`.** It wraps `validateReadablePath`, so it inherits the new check for free.
- **Client-side prevention.** The web UI may still send `/home`; the server's job here is to reject it with a useful message. A separate worker can tighten the UI defaults later.
- **Migrating saved YAML templates.** Templates that contain POSIX paths will start failing on Windows after this lands — that's the intended behavior (they were silently writing to the wrong drive before). Document the new error in the worker's PR description so users know to update their templates.
- **Auto-prepending the CWD drive** as a backwards-compat shim. The user picked the clean "reject and require migration" path. If a user later wants the compat shim, file a follow-up worker.

## Verification checklist

- [ ] Worktree created; manifest row → `in-progress` in its own `chore(manifest):` commit
- [ ] New unit tests pass on Linux/macOS CI (platform is stubbed, not read from the runner)
- [ ] `validateReadablePath("/work")` on Windows throws with a message that names both the input path and the inferred CWD drive
- [ ] `validateReadablePath("/work")` on Linux still passes (no behavior change)
- [ ] Manual: on the dev host (Windows), `yarn start` then hit `POST /queries/listDirectoryEntries` with `{ path: "/home" }` → 4xx with the new error message; previously was an ENOENT log line and 500
- [ ] Standard gate clean (`lint → typecheck → test → e2e → lint`)
- [ ] PR opened against `feat/mux-magic-revamp`
- [ ] [docs/workers/MANIFEST.md](MANIFEST.md) row updated to `done`
