# AGENTS.md

Guidelines for AI agents working on this codebase.

## Project

A Node.js CLI and REST API for batch media file operations (MKV track manipulation,
file renaming, subtitle merging, etc.) using mkvtoolnix, ffmpeg, and mediainfo.

## Code Rules & Conventions

👉 **Full reference:** [docs/agents/code-rules.md](docs/agents/code-rules.md)

Quick summary of the five most-violated rules:

1. **No `for`/`for...of`/`while` loops over arrays.** Use `forEach`/`map`/`filter`/`reduce`.
2. **`const` only. No `var`. No `let` mutation.**
3. **Spell every variable name out.** No single letters or abbreviations.
4. **Booleans start with `is` or `has`.** `isSourceDeleted`, not `deleteSource`.
5. **No array mutation.** No `.push`, `.splice`, `.pop`, `.shift`, `.unshift`, in-place `.sort`/`.reverse`. Build new arrays with `.map`/`.filter`/`.reduce`/`.flatMap`/`.concat`. Prefer the declarative `xs.concat(item)` over `[...xs, item]` for appends — same immutable semantics, reads as plain English. Apply this to test code (sink callbacks, fixtures) as well as production code.

Plus function destructuring (2+ args → single object param), always-braced `if`/`else`, arrow functions with implicit returns, no barrel files, and use `Array.from(foo.values())` instead of `[...foo.values()]` for explicit intent.

**Test-assertion style.** Prefer `expect(spy).toHaveBeenCalledWith(...)` / `.toHaveBeenNthCalledWith(n, ...)` / `.toHaveBeenLastCalledWith(...)` over reaching into `.mock.calls[i]?.[j]`. Use `expect.objectContaining({...})` / `expect.stringContaining(...)` / `expect.anything()` matchers when you only care about a partial shape. The `.mock.calls` accessor is the escape hatch — reserve it for cases where you need to extract a captured callback and invoke it.

**Before opening a PR:** Search your diff for `for(`, `var`, `let` (with reassignment), single-letter names, boolean names without `is`/`has`, `return` (outside tests), import paths ending in folders, `.push(`/`.splice(`/`.pop(`/`.shift(`/`.unshift(`, in-place `.sort()`/`.reverse()`, and `.mock.calls[`. Fix every hit.

**Indentation:** Biome enforces 2-space indentation everywhere. Never use tabs. Run `yarn biome format --write <file>` on every file you create or modify, then `git add` the result. Do not rely on your editor's auto-conversion — verify the committed bytes with `git show HEAD:<path> | cat -A` and confirm no `^I` (tab) characters appear. CI runs on Linux where editor-level tab→space conversion does not happen.

**PowerShell file IO — UTF-8 trap (Windows):** Never bulk-edit source files with `Get-Content -Raw` + `Set-Content -Encoding utf8`. On Windows PowerShell 5.1, `Get-Content` defaults to the system code page (Windows-1252), NOT UTF-8 — it misreads multi-byte UTF-8 sequences (e.g. `─` = `E2 94 80`) as three individual Windows-1252 bytes (`â`, `"`, `€`), and `Set-Content -Encoding utf8` then re-encodes that mojibake as actual UTF-8, producing the doubly-broken `â"€` you'll see in box-drawing comments and emoji. Fixing this corruption is a manual chore that takes hours. For any bulk-edit script, use `[System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)` and `[System.IO.File]::WriteAllText($path, $content, (New-Object System.Text.UTF8Encoding $false))` — these operate on raw bytes outside PowerShell's encoding pipeline and produce UTF-8 without a BOM. Better still: prefer the dedicated Edit tool over any bulk-replace script when the file count is small enough.

## Testing

👉 **Full reference:** [docs/agents/testing.md](docs/agents/testing.md)

Quick checklist:

- Write a test when you fix a bug — every fix needs a regression guard
- Run `yarn test` and `yarn typecheck` before every commit
- Run `yarn lint` from repo root before every push (not just workspace-scoped lint)
- Run `yarn start` in a separate terminal first (starts API + web + Storybook); then `yarn e2e` reuses those servers
- Run `yarn e2e` before merging UI or API route changes
- Keep tests in sync with code changes — tests are documentation
- Verify Playwright tests pass before reporting a fix
- **When changing a component's HTML structure** (e.g. replacing `<details>`/`<summary>` with `<button>`, swapping element types, renaming `data-*` attributes): grep `e2e/` for the old element type, attribute name, or selector and update every matching Playwright locator

Frameworks: vitest (unit + app-command), Hono in-process testing, Playwright (e2e).

### Pre-merge gate (run in order)

1. `yarn lint` — auto-fix formatting (biome + eslint); re-stage changed files
2. `yarn typecheck` — full monorepo type check
3. `yarn test` — unit + integration (vitest)
4. `yarn e2e` — Playwright end-to-end (using your own PORT/WEB_PORT, see "Worker port/PID protocol")
5. `yarn lint` — **re-run last** so Biome catches any formatting touched by typecheck/test/e2e fixes

### Forbidden test styles

- **No snapshot tests.** Never use `toMatchSnapshot`, `toMatchInlineSnapshot`. Spell expected values out inline: `expect(x).toBe("literal string")` or `expect(x).toEqual({ explicit: "object" })`. Reason: snapshot diffs hide intent and get rubber-stamped during auto-update.
- **No screenshot / visual regression tests.** Never use Playwright `toHaveScreenshot`, Percy, Chromatic, or Storybook screenshot addons. There is no VRT platform in this repo. Visual verification is manual via Storybook and the dev server.
- **Use `test()`, not `it()`.** `it` and `test` are aliases; this repo uses `test` for consistency. Import `test` (not `it`) from `vitest`.

### Test interaction conventions

Tests should describe what a **human user** does and sees, not what the DOM contains. Pick the simulation tier and the assertion that matches the user's perspective.

#### Prefer `user-event` over `fireEvent`

- **Default:** drive interactions with `@testing-library/user-event` (`await user.click(...)`, `await user.type(...)`, `await user.keyboard(...)`, `await user.tripleClick(...)`). `user-event` simulates real focus/selection/keyboard sequencing — a human clicking, focusing, typing — which catches bugs `fireEvent` skips.
- **`fireEvent.*` is a last resort.** Reach for it ONLY when (a) you need to fire an event no human can produce (`drop`, `paste` with a synthetic `DataTransfer`, `wheel`), or (b) you've documented a known framework race that `user-event` cannot work around — and even then, leave a comment explaining why a real user gesture isn't being used. "I couldn't get user-event to work" is not a reason; it's a signal to redesign the test.
- **Don't substitute `fireEvent.change` for typing.** An `<input>` that a human types into MUST be tested with `user.type` / `user.keyboard`. If `user.type` is dropping keystrokes, the failure is a real framework constraint (see "Replacing controlled input contents" below) and the test needs redesign, not a `fireEvent.change` workaround.

#### Replacing controlled input contents

Vitest runs the web tests in browser mode (real chromium via Playwright). With React controlled inputs whose `onChange` writes to a **Jotai atom** (not local `useState`), the atom update re-renders the input's parent on every keystroke, which races vitest-browser's keystroke timing — `user.clear(input)` then `user.type(input, "abc")` can land only the last keystroke. Recipes, in order of preference:

1. **Type fresh.** Start the test with the input's atom value at `""` and `await user.type(input, "newvalue")`. No clearing needed. This is also the more meaningful flow to test (new variable, user types initial value).
2. **End-to-end via Playwright e2e.** If pre-filled-then-replaced is the genuine user flow, cover it in `e2e/*.spec.ts` where Playwright's native `locator.fill()` doesn't have the race.
3. **Don't test the keystroke roundtrip in unit tests.** Assert atom→input data binding instead (`renderCard({ value: "74759" }); expect(input).toHaveValue("74759")`), then rely on the e2e for the type-and-persist flow.

Local-state inputs (`useState` inside the same component as the `<input>`) don't have this race — `user.type` works normally because the re-render is local and synchronous. The trap is specifically global-store-backed controlled inputs.

#### Prefer `.toBeVisible()` over `.toBeInTheDocument()`

Default to `expect(node).toBeVisible()`. A human sees the element only if it's rendered AND not hidden by `display: none` / `visibility: hidden` / `hidden` attribute / a zero-size box / an ancestor that hides it. `.toBeInTheDocument()` passes for an element that's mounted-but-invisible, which is a test that says "the DOM contains X" rather than "the user can see X" — and that's the bug bullseye for accessibility regressions and CSS-driven UI breaks.

Use `.toBeInTheDocument()` only when you're deliberately asserting a hidden-by-design element exists (off-screen live regions for screen readers, prefetch placeholders, conditional offscreen mounts) and add a comment naming the reason.

#### Prefer positive operations

- **`array.every(predicate)`** over `!array.some(opposite)`. Reads as "all match" instead of "none don't match."
- **`array.find(predicate)`** over `array.filter(predicate)[0]`.
- **`array.some(predicate)`** over `array.filter(predicate).length > 0`.
- **Equality** over double-negation. `value === expected` over `!(value !== expected)`.

Negation buried in a chain reads as a riddle; positive forms read as a statement. Save negation for cases where the negative is genuinely the simpler concept being expressed.

## Storybook

Every new component **must** ship with three files in the same directory:

1. `ComponentName.stories.tsx` — one named export per distinct visual state (Indeterminate, Determinate, WithPerFileRows, Complete, etc.). Stories must show the component isolated from page-level concerns; use a Jotai `Provider` + `createStore` to inject atom state rather than relying on live network calls or global atoms.
2. `ComponentName.mdx` — prose description, a prop table, and `<Canvas>` embeds for every story.
3. The component file itself.

**Before opening a PR that adds a component:** confirm all three files are present and Storybook renders each story without errors.

## External Tool Binaries (Windows)

Windows executables that are not installed system-wide live under `packages/server/assets.downloaded/`:

| Tool | Path |
|------|------|
| MediaInfo | `assets.downloaded/mediainfo/MediaInfo.exe` |
| mkvextract | `assets.downloaded/mkvtoolnix/mkvextract.exe` |
| mkvmerge | `assets.downloaded/mkvtoolnix/mkvmerge.exe` |
| mkvpropedit | `assets.downloaded/mkvtoolnix/mkvpropedit.exe` |

The `MEDIAINFO_PATH` environment variable overrides the default MediaInfo path (useful for pointing at a system-installed copy or a different version). See `packages/server/src/tools/appPaths.ts` for all path resolution logic. On Linux/Mac, all tools are assumed to be in `PATH` — no `assets.downloaded/` directory is used.

## Architecture & Design Patterns

👉 **Full reference:** [docs/agents/architecture.md](docs/agents/architecture.md)

Key concepts:

- **Package manager:** Always `yarn`, never `npm` or `npx`
- **Observable-first:** Every command returns an Observable; errors via `catchNamedError`
- **Pure functions:** No direct mutation; use store functions that return new objects
- **API structure:** Focused modules (types, jobStore, logCapture, jobRunner, routes)
- **Sequence Runner:** `/sequences/run` DSL for multi-step job composition

See the detailed guide for CLI command modules, adding new commands, and utility patterns.

## Workflows & Collaboration

👉 **Full reference:** [docs/agents/workflows.md](docs/agents/workflows.md)

**Role identification:**

- **Primary** (repo root, branch `master` or `feat/mux-magic-revamp`):
  Never push unless told. Commit-as-you-go keeps work safe.
- **Worker** (`.claude/worktrees/<id>_<slug>/`, branch `worker-<id>-<slug>`):
  Commit and push every change to your sub-branch. Open a PR against `feat/mux-magic-revamp`.
  Only merge when explicitly told.

**Worktree workflow:** Commit as you go → push to PR → user reviews → merge when told.

**Commit conventions:** One logical group per commit. Don't batch multi-step work into a single end-of-session commit. Use `git add -p` to split unrelated concerns in the same file.

## Worker port/PID protocol

Workers running e2e in worktrees must not collide with each other or with the user's
running dev servers. Pick random unused ports per session and tear down only your own PIDs.

### PowerShell (Windows)

```powershell
$env:PORT = Get-Random -Minimum 30000 -Maximum 65000
$env:WEB_PORT = Get-Random -Minimum 30000 -Maximum 65000
$servers = Start-Process -PassThru -NoNewWindow yarn -ArgumentList "prod:servers"
$serversPid = $servers.Id
# … run `yarn e2e` …
Stop-Process -Id $serversPid -Force
```

### Bash (Linux/Mac)

```bash
export PORT=$((30000 + RANDOM % 35000))
export WEB_PORT=$((30000 + RANDOM % 35000))
yarn prod:servers &
SERVERS_PID=$!
# … run `yarn e2e` …
kill -9 "$SERVERS_PID"
```

**Rule:** never `pkill` or `taskkill /F /IM node.exe` — those kill other workers' and the
user's servers too. Always target your captured PID.

If `playwright.config.ts` `reuseExistingServer` is true, set `CI=true` for your session
so Playwright spins up its own servers against your PORT/WEB_PORT.

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

## Worker addressing

The Mux-Magic huge revamp uses sequential 2-hex worker IDs (`01`–`35`+) with the manifest
table at [docs/workers/MANIFEST.md](docs/workers/MANIFEST.md). Each worker has a corresponding
prompt file at `docs/workers/<id>_<slug>.md`. Workers update their own row in the manifest
when they start (`in-progress`) and finish (`done`); IDs are never renumbered.

## Test coverage discipline

For any functionality change, tests must match the change scope:

- **Adding new functionality:** write tests covering the new behavior. Unit for logic;
  component/integration for UI; e2e if the feature spans more than one route or has
  cross-component interactions.
- **Updating existing functionality:** add tests for the new behavior OR update existing
  tests. Don't leave tests asserting old behavior that the change has invalidated.
- **e2e tests are valuable where they make sense.** Particularly: full sequence runs,
  modal flows that span open → action → close, undo/redo, drag-and-drop. Less valuable
  for pure-presentation changes.

This is in addition to the existing TDD-failing-test-first convention. TDD catches bugs
(write the test that proves the bug, then fix); the discipline above catches missing
coverage (new feature without tests, or refactor that left tests asserting dead code).

**Why:** manual testing is the user's compensation when automated coverage is thin.
Tests that match change scope keep that out-of-pocket cost low.
