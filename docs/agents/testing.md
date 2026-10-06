# Testing Guidelines

## Testing Discipline

1. **Write a test when you fix a bug.** If you fix something, add a test (unit, route, or e2e as appropriate) that would have caught it. No fix ships without a regression guard.
2. **Run `pnpm test` and `pnpm typecheck` before every commit.** Both must be clean. Run `pnpm e2e` before merging code that touches the builder UI or API routes. Don't announce a commit/PR as done while tests are red.
3. **Keep tests in sync with code changes.** When you change behavior, update the tests that assert the old behavior. Leaving a test that no longer matches the current intent (even if it still passes) is misleading; leaving a test that fails is a blocker. Tests are documentation — they must describe what the code *actually does now*, not what it used to do.
4. **Verify Playwright tests pass before reporting a fix.** After writing an e2e test, run it (`pnpm dlx playwright test e2e/builder.spec.ts --grep "<test name>"`) and confirm it passes. Merge conflicts, module refactors, and missed sub-file updates can silently break tests that look logically correct — observed test output is the only reliable signal. Never report a UI fix as done without a passing test run.

## Every browser test runs in four windows

The `web` and `storybook` Vitest projects and the Playwright e2e suite all run once per window — `narrow` 384x824 (a Galaxy S23 Ultra), `tall` 1080x1920, `wide` 1920x1080, `ultrawide` 3440x1440 — from `@charcuterie/vitest-config` / `@charcuterie/playwright-config` ([decision](https://github.com/Sawtaytoes/charcuterie/blob/master/docs/decisions/2026-10-04-every-browser-test-runs-in-four-named-windows.md)). A test that fails in one window is triaged, never pinned back to one window. When a claim is genuinely true in only one kind of window, split it so each window gets the claim that IS true there, without a skip (this repo reports zero skipped): in Vitest, register the tests by `inject("viewport")`; in Playwright, tag the test `@narrow-view` (collected only in `chromium-narrow`) or `@wide-view` (the other three) — `playwright.config.ts` routes the tags. One window alone: `pnpm vitest run --project '*-narrow'` / `pnpm playwright test --project chromium-narrow`.

## Pre-merge gate (run in order)

1. `pnpm lint` — auto-fix formatting (biome + eslint); re-stage changed files
2. `pnpm typecheck` — full monorepo type check
3. `pnpm test` — unit + integration (vitest)
4. `pnpm e2e` — Playwright end-to-end (using your own `PORT`, see [worker-port-protocol.md](worker-port-protocol.md))
5. `pnpm lint` — **re-run last** so Biome catches any formatting touched by typecheck/test/e2e fixes

> ### Steps 3 and 4 fail to start in an agent sandbox — this is not your code
>
> The `web` project runs vitest in **browser mode**, so it needs a Playwright chromium
> build. An agent container ships browsers for its own globally-installed Playwright at
> a root-owned `/opt/pw-browsers`, and points `PLAYWRIGHT_BROWSERS_PATH` there. This repo
> pins its **own** Playwright, which wants a **different** revision, and the directory is
> not writable by the agent user. The run dies before the first test with a message naming
> a build number that is not there.
>
> Install this repo's build somewhere writable and point the run at it:
>
> ```sh
> PLAYWRIGHT_BROWSERS_PATH=/tmp/pw-browsers pnpm playwright install chromium-headless-shell
> PLAYWRIGHT_BROWSERS_PATH=/tmp/pw-browsers pnpm vitest run --project web
> ```
>
> Add `--dry-run` to the install to print the exact revision and path without downloading.
> `pnpm e2e` wants the full `chromium`, not the headless shell.
>
> ⚠️ **Do not "fix" this by changing the repo.** Bumping `playwright` in `package.json`,
> editing `playwright.config.ts`, or editing `packages/web/vitest.config.ts` to match the
> container changes what this repo tests against, and CI does not have the problem. It
> installs the pinned version itself.
>
> ⚠️ **Do not report the UI as untested because of it.** A run that passed with the
> override is a passing run; say that you used the override. Cross-repo detail:
> `docs/runbooks/agent-sandbox-runtime.md` in the `agentic` workspace.

## Forbidden test styles

- **No snapshot tests.** Never use `toMatchSnapshot`, `toMatchInlineSnapshot`. Spell expected values out inline: `expect(x).toBe("literal string")` or `expect(x).toEqual({ explicit: "object" })`. Reason: snapshot diffs hide intent and get rubber-stamped during auto-update.
- **No screenshot / visual regression tests.** Never use Playwright `toHaveScreenshot`, Percy, Chromatic, or Storybook screenshot addons. There is no VRT platform in this repo. Visual verification is manual via Storybook and the dev server.
- **Use `test()`, not `it()`.** `it` and `test` are aliases; this repo uses `test` for consistency. Import `test` (not `it`) from `vitest`. Enforced by the `vitest/consistent-test-it` ESLint rule (see [eslint.config.js](../../eslint.config.js)).

## When changing component HTML structure

When you change a component's HTML structure (e.g. replacing `<details>` / `<summary>` with `<button>`, swapping element types, renaming `data-*` attributes): grep `e2e/` for the old element type, attribute name, or selector and update every matching Playwright locator.

## Test interaction conventions

See [test-interactions.md](test-interactions.md) for `user-event` vs `fireEvent`, controlled-input races, `.toBeVisible()` vs `.toBeInTheDocument()`, positive operations, and test-assertion style.

## Test coverage discipline

For any functionality change, tests must match the change scope:

- **Adding new functionality:** write tests covering the new behavior. Unit for logic; component/integration for UI; e2e if the feature spans more than one route or has cross-component interactions.
- **Updating existing functionality:** add tests for the new behavior OR update existing tests. Don't leave tests asserting old behavior that the change has invalidated.
- **e2e tests are valuable where they make sense.** Particularly: full sequence runs, modal flows that span open → action → close, undo/redo, drag-and-drop. Less valuable for pure-presentation changes.

This is in addition to the existing TDD-failing-test-first convention. TDD catches bugs (write the test that proves the bug, then fix); the discipline above catches missing coverage (new feature without tests, or refactor that left tests asserting dead code).

**Why:** manual testing is the user's compensation when automated coverage is thin. Tests that match change scope keep that out-of-pocket cost low.

## Unit Tests (vitest)

- Framework: vitest. Run with `pnpm test`.
- `node:fs` and `node:fs/promises` are globally mocked with `memfs` (see `vitest.setup.ts`)
- Tests live next to their source file: `foo.ts` → `foo.test.ts`
- Use `captureConsoleMessage` / `captureLogMessage` helpers to silence and inspect console output
- Use `vol.fromJSON(...)` from memfs to seed the virtual filesystem

Modules under `packages/core/src/cli-spawn-operations/` are auto-mocked in `vitest.setup.ts` — every spawn-op wraps a 3rd-party `mkvtoolnix` / `ffmpeg` / `fpcalc` binary, so we draw the test boundary at the process-spawn layer the same way we draw it at the `node:fs` boundary with memfs. Tests opt in to per-call behavior with `vi.mocked(spawnOpFn).mockReturnValue(...)`; forgetting to stub returns an explicit error (loud failure) rather than silently shelling out. If a test file exercises the *real* spawn-op implementation (e.g. unit tests for the spawn-op itself), call `vi.unmock("./theSpawnOp.js")` at the top of that file to restore the actual module.

## App-Command Tests (memfs-backed)

App commands return Observables and write through `node:fs/promises`, so the unit-test pattern is: seed the virtual filesystem with `vol.fromJSON`, run the observable to completion via `firstValueFrom(... .pipe(toArray()))` (or `lastValueFrom` for the final emission), then assert filesystem state with `stat` / `readFileSync`. See `flattenOutput.test.ts` and `deleteFilesByExtension.test.ts` for the canonical shape.

Errors swallowed by `catchNamedError` complete the observable as `EMPTY` rather than rejecting — assert `emissions).toEqual([])` and use `captureConsoleMessage('error', ...)` to capture the logged reason.

## Hono Route Tests (In-Process)

Each sub-app (e.g. `jobRoutes`, `queryRoutes`) is an `OpenAPIHono` instance — exercise it directly with `subApp.request(url, init)`; no real HTTP server needed. See `src/api/routes/jobRoutes.test.ts` (in-memory state via `jobStore`, reset in `afterEach`) and `src/api/routes/queryRoutes.test.ts` (filesystem-backed routes seeded with `vol.fromJSON`) for examples. POST helper:

```ts
const post = (path: string, body: unknown) => subApp.request(path, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})
```

Query routes that wrap filesystem / network calls return `{ ..., error: string | null }` at HTTP 200 instead of 500-ing — assert on `body.error`, not on `response.status`.

## Browser-Driven Tests (Playwright Test)

- Framework: `@playwright/test`. Tests live in `e2e/*.spec.ts`.
- **Always use `yarn` for Playwright, never `npx playwright`.** Run headless once: `pnpm e2e`. Run interactively: `pnpm e2e:ui` (opens Playwright's UI mode for stepping through). For individual tests: `pnpm dlx playwright test e2e/builder.spec.ts --grep "<test name>"`. Do not use `npx playwright` — it pulls from the public registry instead of your locked local version.
- The first run requires `pnpm install-playwright-browser` to fetch the Chromium binary.

### Server setup for e2e

E2e tests run against one front-door server on `PORT` (default 3000) that hosts /, /api, and /storybook in one process. Worker 29 collapsed the previous two-server layout.

**Recommended local workflow:** start the dev server once in a separate terminal, then run `pnpm e2e` as many times as you like — Playwright reuses the already-running process:

```
# terminal 1 — keep running
pnpm start        # = `pnpm dev` = `pnpm --filter @mux-magic/server dev`
                  # tsx-watch on packages/server/src/index.ts; Vite middleware
                  # serves the SPA, Storybook is spawned as a child and
                  # proxied at /storybook/.

# terminal 2
pnpm e2e          # attaches to the running server; no cold-start penalty
```

**Without a pre-running server:** `pnpm e2e` will auto-start `pnpm prod:server` itself (via `playwright.config.ts` `webServer`), but this incurs a build + cold-start penalty on every run.

**CI:** always starts fresh prod servers — never reuses an existing process.

### Stubbing backend data

For tests that depend on backend data (search/lookup/listDirectoryEntries), use `page.route('**/queries/<endpoint>', ...)` to stub the network rather than hitting real services. See the path-typeahead test in `e2e/builder.spec.ts` for the pattern.

- Generated artifacts (`playwright-report/`, `test-results/`) are gitignored.
