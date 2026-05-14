# WORKER W8G — MediaInfo.exe Path Configuration + Startup Race

**Model:** Haiku · **Thinking:** OFF · **Effort:** Low
**Branch:** `react-migration`
**Parallel with:** W8B W8C W8D W8E W8F W8H W8I W8J

---

## Universal Rules

1. **Branch:** all work on `react-migration`. No new branches.

2. **TDD workflow — mandatory:**
   - Write the test first. The test must fail before you write any fix code.
   - Commit the failing test: `test(<area>): failing test for <bug description>`
   - Write the minimum code to make the test pass.
   - Commit the fix: `fix(<area>): <description>`
   - Do not skip the failing-first step.

3. **Pre-push gate — every push, no exceptions:**
   ```bash
   yarn test run
   yarn typecheck
   yarn lint
   ```

4. **E2E gate — run before marking Done:**
   ```bash
   yarn test:e2e
   ```
   If no e2e suite exists yet, note it in the checklist and continue.

5. **Test rules:** No snapshot tests. No screenshot tests. Assertions must be explicit
   inline values (`expect(x).toBe("literal")` or `expect(x).toEqual({ key: "value" })`).

6. **Commit-and-push as you go.** Small logical chunks.

7. **Update `docs/react-migration-checklist.md`** at start (🔄 In Progress) and end
   (✅ Done) of your worker section. Include one progress-log line per push.

8. **Yarn only.** Never npm or npx.

---

## Bug B9 — MediaInfo.exe Hardcoded Path

The server logs `spawn assets/mediainfo/MediaInfo.exe ENOENT` on every file scan because
the `assets/` directory is empty — the binary was never committed (correct: binaries
don't belong in git). There is no env-var override, so users cannot point to their own
MediaInfo installation without editing source code.

`packages/server/src/tools/appPaths.ts` line ~15:
```ts
export const mediaInfoPath = isWindows
  ? "assets/mediainfo/MediaInfo.exe"
  : "mediainfo"
```

### TDD steps

1. Write a test that asserts `mediaInfoPath` equals `process.env.MEDIAINFO_PATH` when
   that env var is set to a custom value. This test must fail first.
2. Update `appPaths.ts` to:
   ```ts
   export const mediaInfoPath =
     process.env["MEDIAINFO_PATH"] ??
     (isWindows ? "assets/mediainfo/MediaInfo.exe" : "mediainfo")
   ```
3. Update `.env.example` to document the new variable:
   ```
   # Path to the MediaInfo CLI binary.
   # Windows default: assets/mediainfo/MediaInfo.exe (place MediaInfo.exe there, or override here)
   # Linux/Mac default: mediainfo (must be in PATH)
   # MEDIAINFO_PATH=C:\Program Files\MediaInfo\MediaInfo.exe
   ```
4. Verify the test passes.

---

## Bug B10 — Startup Race Condition

`yarn start` runs all 4 processes simultaneously via `concurrently --kill-others`.
Vite starts before Hono is ready, causing ECONNREFUSED proxy errors on the first few
requests (observed on `/jobs/stream` SSE endpoint).

### TDD steps

1. There is no unit test for process startup order — document this in the checklist
   and proceed directly to the fix.
2. Add `wait-on` as a dev dependency:
   ```bash
   yarn add -D wait-on
   ```
3. In root `package.json`, split the `start` script so the Vite process waits for
   port 3000. Read `package.json` first to see the exact current script names, then
   add a `wait-on tcp:3000 &&` prefix to the web start command. For example:
   ```json
   "start:web": "wait-on tcp:3000 && yarn workspace @media-tools/web dev",
   "start": "concurrently --kill-others \"yarn start:api\" \"yarn start:web\""
   ```
   Adjust names to match what currently exists.
4. Verify `yarn start` no longer logs ECONNREFUSED on startup.

## Files

- `packages/server/src/tools/appPaths.ts`
- `.env.example` (repo root)
- `package.json` (root) — split start script to add `wait-on`

---

## Verification checklist

Before marking Done:

- [ ] Failing test committed before fix code (B9 only — B10 has no unit test)
- [ ] `yarn test run` — all tests pass
- [ ] `yarn typecheck` — clean
- [ ] `yarn lint` — clean
- [ ] `yarn test:e2e` — passes (or noted in checklist if suite absent)
- [ ] New tests cover the exact regression scenario
- [ ] Checklist row updated to ✅ Done in `docs/react-migration-checklist.md`
- [ ] Pushed to `origin/react-migration`
