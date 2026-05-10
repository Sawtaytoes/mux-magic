# Testing Guidelines

## Testing Discipline

1. **Write a test when you fix a bug.** If you fix something, add a test (unit, route, or e2e as appropriate) that would have caught it. No fix ships without a regression guard.
2. **Run `yarn test` and `yarn typecheck` before every commit.** Both must be clean. Run `yarn e2e` before merging code that touches the builder UI or API routes. Don't announce a commit/PR as done while tests are red.
3. **Keep tests in sync with code changes.** When you change behavior, update the tests that assert the old behavior. Leaving a test that no longer matches the current intent (even if it still passes) is misleading; leaving a test that fails is a blocker. Tests are documentation — they must describe what the code *actually does now*, not what it used to do.
4. **Verify Playwright tests pass before reporting a fix.** After writing an e2e test, run it (`yarn dlx playwright test e2e/builder.spec.ts --grep "<test name>"`) and confirm it passes. Merge conflicts, module refactors, and missed sub-file updates can silently break tests that look logically correct — observed test output is the only reliable signal. Never report a UI fix as done without a passing test run.

## Unit Tests (vitest)

- Framework: vitest. Run with `yarn test`.
- `node:fs` and `node:fs/promises` are globally mocked with `memfs` (see `vitest.setup.ts`)
- Tests live next to their source file: `foo.ts` → `foo.test.ts`
- Use `captureConsoleMessage` / `captureLogMessage` helpers to silence and inspect console output
- Use `vol.fromJSON(...)` from memfs to seed the virtual filesystem

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
- **Always use `yarn` for Playwright, never `npx playwright`.** Run headless once: `yarn e2e`. Run interactively: `yarn e2e:ui` (opens Playwright's UI mode for stepping through). For individual tests: `yarn dlx playwright test e2e/builder.spec.ts --grep "<test name>"`. Do not use `npx playwright` — it pulls from the public registry instead of your locked local version.
- `playwright.config.ts` boots `yarn api-server` automatically before tests run; in dev it reuses an already-running server, in CI it starts a fresh one.
- The first run requires `yarn install-playwright-browser` to fetch the Chromium binary.
- For tests that depend on backend data (search/lookup/listDirectoryEntries), use `page.route('**/queries/<endpoint>', ...)` to stub the network rather than hitting real services. See the path-typeahead test in `e2e/builder.spec.ts` for the pattern.
- Generated artifacts (`playwright-report/`, `test-results/`) are gitignored.
