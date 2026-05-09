# AGENTS.md

Guidelines for AI agents working on this codebase.

## Project

A Node.js CLI and REST API for batch media file operations (MKV track manipulation,
file renaming, subtitle merging, etc.) using mkvtoolnix, ffmpeg, and mediainfo.

## Code rules — apply to ALL source files

These rules apply to **every** source file: TypeScript, modern JS, and the plain `<script>`-tag JS in `public/**`. There is no "this is a small browser JS file, the TS rules don't count" exception. `public/format-bandwidth.js`, `public/jobs/job-card.js`, `src/**/*.ts` — same rules. Don't pattern-match off file extension; pattern-match off "is this source code in this repo."

The four below are the most-violated; the detailed reference lives in [Key conventions](#key-conventions) further down.

1. **No `for` / `for...of` / `while` loops over arrays.** Use `forEach` / `map` / `filter` / `reduce` (or `concatMap` / `mergeMap` in observable code). C-style `for (let i = 0; ...)` and `for (const x of arr)` are both banned.
2. **`const` only. No `var`. No `let` mutation.** If you reach for `let` to accumulate a value, you want `reduce` or `map`. `var` is banned outright — `public/**.js` runs in modern Chrome, there's no hoisting excuse.
3. **Spell every variable name out.** Single letters (`i`, `h`, `m`, `s`, `c`, `el`) and 2-3 letter abbreviations (`bps`, `idx`, `ctx`, `opts`, `dest`, `src`, `val`, `err`) are banned. Use `index`, `hours`, `minutes`, `seconds`, `context`, `element`, `bitsPerSecond`, `options`, `destination`, `source`, `value`, `error`.
4. **Booleans must start with `is` or `has`.** Function params, object properties, schema fields, CLI flags, local variables — all of them. `deleteSourceOnSuccess` is wrong; `isSourceDeletedOnSuccess` is right. `useDefaultRules` is wrong; `hasDefaultRules` is right. The prefix tells a reader at a glance that the value is yes/no, not a string or function. Matches the existing `isRecursive` / `hasChapterSyncOffset` / `hasFirstAudioLanguage` patterns.
5. **Function arguments: single destructured object, not positional.** Any function that takes 2+ arguments uses a single object parameter with destructuring. `mountLogsDisclosure(parent, jobId, status)` is wrong; `mountLogsDisclosure({ parent, jobId, status })` is right. Callers pass `{ parent, jobId, status }`. Reasons: argument order doesn't matter at the call site, params are self-documenting, dropping/adding/renaming a param doesn't reshuffle every caller. Single-arg functions stay as-is (`getMediaInfo(filePath)`); the rule only kicks in at 2+. Existing positional functions are not retroactively required to change, but any function you create or whose signature you modify must follow this.
6. **Always brace `if` / `else` / `for` / `while`.** Even for early returns and one-liners. `if (!x) return null` is wrong; only the multi-line braced form is allowed.
7. **`const` + arrow functions only — no `function` declarations.** `function loadYaml(text) { ... }` is wrong; `const loadYaml = (text: string) => parse(text)` is right. The only exception is when `this` binding is explicitly required (essentially never in this codebase — hooks, event handlers, and utilities all close over the outer scope). React components are arrow functions too: `const LoadModal = () => (<div>...</div>)`, not `function LoadModal() { ... }`.
8. **Implicit returns only — never write the `return` keyword in production code.** When an arrow function returns a value, the body is the expression itself, wrapped in `()` for multi-line grouping. The canonical shape:

   ```ts
   const handle = (request) => (
     request.json()
   )
   ```

   Not `(request) => { return request.json() }`, not `(request) => { return request.json(); }`. Multi-step logic uses promise chains (`.then` / `.catch`), ternaries, `&&` / `||`, and `()` grouping — never a `{ return ... }` block.

   Side-effect-only callbacks (no return value at all) are written as `() => { doSomething() }` and are fine — there's no `return` keyword in that form, so the rule isn't engaged. The rule is specifically: when you have a value to return, return it as the expression, not via the `return` keyword.

   The single allowed exception is `return` inside test bodies (`it("name", async () => { ... })`), where bodies are imperative `expect(...)` sequences. Outside tests, search your diff for `return ` and fix every hit.
9. **No barrel files.** No `index.ts` or `index.css` re-export files inside component, state, util, or icon folders. Import each module by its full path: `import { LoadModal } from "./components/LoadModal"`, not `from "./components"`. The single allowed barrel is `packages/shared/src/index.ts`, which exists only because `@media-tools/shared` is published to npm and consumers need a stable public entry point. Enforced by `import-x/no-barrel-files` in `eslint.config.js`.

### Before opening a PR — self-check your diff

The agents shipping PRs in this repo have repeatedly violated rules 1–4. Before you announce a PR, search your diff (`git diff master...HEAD -- '*.ts' '*.js' '*.mjs'`) for these literal substrings, and fix every hit:

| Search for | Means you violated |
|------------|--------------------|
| `for (` or `for(` | rule 1 |
| `for ... of` (in your additions) | rule 1 |
| `var ` (with trailing space) | rule 2 |
| `let ` followed by reassignment of the same name later | rule 2 |
| Single-letter loop counters / accumulator names | rule 3 |
| Boolean field/var without `is`/`has` prefix (added in your diff) | rule 4 |
| New/modified function signature with 2+ positional params (instead of single destructured object) | rule 5 |
| `if (` on a line whose closing `)` is followed by anything other than ` {` | rule 6 |
| `^function ` or `^export function ` (lines starting with `function`) | rule 7 |
| `return ` keyword in your additions (outside test files) | rule 8 (use `() => (expression)` instead) |
| Import path ending in a folder rather than a file (`from "./components"`, `from "../state"`) | rule 9 |
| Multi-paragraph JSDoc blocks (`/** ... */` over more than one short line) | over-commenting (default: no comments — see "Doing tasks" guidance) |

Workers that ship code containing any of the above will get the PR sent back. Catch it yourself first.

## Key conventions

### Package manager

Use `yarn` and `yarn dlx`, not `yarn` and `yarn dlx`. The repo's lockfile is `yarn.lock`; mixing the two desynchronizes installs. Examples: `yarn vitest run` (not `yarn dlx vitest run`), `yarn dlx <pkg>` (not `yarn dlx <pkg>`).

### Observable-first
Every command module returns an `Observable`. Errors are handled via `catchNamedError`
(which logs via `console.error` and returns `EMPTY` — they do not surface as observable
errors to the subscriber).

### Pure functions / no direct mutation
State updates must go through store functions that return new objects (spread-based).
Do not mutate object properties directly (e.g. `job.status = "x"` is wrong;
use `updateJob(id, { status: "x" })` instead).

### No `process.exit()` in modules
`process.exit()` belongs only in `src/cli.ts` handlers. Any `tap(() => process.exit())`
in module files must be removed before those modules can be used in the API.

### Variable naming
- No single-letter variable names. Always use descriptive names that convey purpose.
- No two- or three-letter abbreviations either (e.g. `lv`, `pv`, `el`, `msf`, `idx`). Spell the word out — `linkedValue`, `pathVar`, `element`, `mainSourceField`, `index`.
- Hono route handler context: use `context` (not `c`). Example: `app.get("/", (context) => context.json({}))`.
- Spell out all abbreviations in variable names (e.g. `destination` not `dest`, `source` not `src`, `options` not `opts`, `value` not `val`, `error` not `err`, `response` not `resp`).
- Function names take an action verb; variables hold the noun the function returns. `linkedVal` is wrong on two counts — it abbreviates `Value`, and as a function it should describe the action: `getLinkedValue` is the function, and the variable that captures its result is `linkedValue`.
- **Booleans must start with `is` or `has`.** This includes function parameters, object properties, schema fields, CLI flags, and local variables. `deleteSourceOnSuccess` is wrong — `isSourceDeletedOnSuccess` reads as a question and matches the existing `isRecursive` / `hasChapterSyncOffset` / `hasFirstAudioLanguage` patterns. The prefix tells a reader at a glance that the value is yes/no, not a string or function.

### Coding style
- Functional style; prefer `concatMap` / `mergeMap` over imperative loops
- For iterating arrays, use functional methods (`forEach`, `map`, `filter`, `reduce`, etc.) instead of `for...of` loops
- Imports sorted alphabetically within each group
- Observable pipelines broken across lines (see existing modules for reference)
- Always use multi-line braced `if` bodies, even for early returns and one-liners. Don't write `if (!cmd) return null` — write:

  ```ts
  if (!cmd) {
    return null
  }
  ```

  Same rule for `else`, `for`, `while`. The brace cost is one line; the safety against silent edit mistakes (adding a second statement that quietly falls outside the conditional) is worth it.

### Function style (arrow functions, implicit returns)

All functions in this codebase are `const` + arrow functions. The `function` keyword is reserved for the rare case where a `this` binding is genuinely required — that case hasn't come up in this repo yet, and almost certainly won't come up in React code either (hooks, event handlers, and utilities all close over the outer scope, and JSX components do not need their own `this`).

**Implicit returns are mandatory: never write the `return` keyword.** When a function returns a value, the body *is* that value as an expression, wrapped in `()` for grouping when it spans multiple lines. The canonical shape:

```ts
const handle = (request) => (
  request.json()
)

const flattenSteps = (steps: Step[]) => (
  steps.flatMap((step) =>
    isGroup(step) ? step.children : [step]
  )
)

const loadYaml = (text: string) => parse(text)
```

These are wrong because they use the `return` keyword:

```ts
// WRONG — function declaration
function loadYaml(text) {
  return parse(text)
}

// WRONG — block body with return
const loadYaml = (text: string) => {
  return parse(text)
}

// WRONG — async with return
const fetchJobs = async () => {
  const response = await client.GET("/jobs")
  return response.data
}
```

Async returns are still implicit — chain them through Promises:

```ts
// RIGHT
const fetchJobs = () => (
  client.GET("/jobs").then((response) => response.data)
)
```

Side-effect-only callbacks (no value to return) keep the `{ ... }` form because there's no `return` keyword involved at all:

```ts
// fine — nothing being returned, no `return` written
.then(() => {
  console.log("Updated schemas.")
})
```

The single allowed place for the `return` keyword is **inside test bodies** — `it("name", async () => { ... })` blocks are imperative `expect(...)` sequences and occasionally need an early `return` for guard conditions. Outside tests, search your diff for `return ` and rewrite every hit as an expression.

If a non-test function feels like it "needs" `return`, the rewrite usually exists: ternaries, `&&` / `||`, optional chaining, promise chains (`.then` / `.catch`), and `()` grouping cover virtually every case. When the rewrite is genuinely awkward, that's a signal to split the function into smaller pieces, each of which *is* an expression.

### Module exports — no barrel files

There are **no `index.ts` re-export files** inside component, state, util, hook, or icon folders. Import every module by its full path:

```ts
// WRONG
import { LoadModal } from "./components"
import { stepsAtom, pathsAtom } from "./state"

// RIGHT
import { LoadModal } from "./components/LoadModal"
import { stepsAtom } from "./state/stepsAtom"
import { pathsAtom } from "./state/pathsAtom"
```

The single allowed barrel in the entire repo is `packages/shared/src/index.ts`. It exists because `@media-tools/shared` is published to npm and external consumers need a stable import surface — without that one barrel, every consumer would have to know the package's internal file layout. Inside the monorepo, no such barrier exists; full paths keep imports honest, make dead code visible to bundlers, and prevent the "import the whole folder to get one thing" pattern that hides accidental coupling.

Enforced by `import-x/no-barrel-files` in `eslint.config.js`.

## Testing

### Testing discipline

1. **Write a test when you fix a bug.** If you fix something, add a test (unit, route, or e2e as appropriate) that would have caught it. No fix ships without a regression guard.
2. **Run `yarn test` and `yarn typecheck` before every commit.** Both must be clean. Run `yarn e2e` before merging code that touches the builder UI or API routes. Don't announce a commit/PR as done while tests are red.
3. **Keep tests in sync with code changes.** When you change behavior, update the tests that assert the old behavior. Leaving a test that no longer matches the current intent (even if it still passes) is misleading; leaving a test that fails is a blocker. Tests are documentation — they must describe what the code *actually does now*, not what it used to do.
4. **Verify Playwright tests pass before reporting a fix.** After writing an e2e test, run it (`yarn dlx playwright test e2e/builder.spec.ts --grep "<test name>"`) and confirm it passes. Merge conflicts, module refactors, and missed sub-file updates can silently break tests that look logically correct — observed test output is the only reliable signal. Never report a UI fix as done without a passing test run.

### Unit tests (vitest)

- Framework: vitest. Run with `yarn test`.
- `node:fs` and `node:fs/promises` are globally mocked with `memfs` (see `vitest.setup.ts`)
- Tests live next to their source file: `foo.ts` → `foo.test.ts`
- Use `captureConsoleMessage` / `captureLogMessage` helpers to silence and inspect console output
- Use `vol.fromJSON(...)` from memfs to seed the virtual filesystem

### App-command tests (memfs-backed)

App commands return Observables and write through `node:fs/promises`, so the unit-test pattern is: seed the virtual filesystem with `vol.fromJSON`, run the observable to completion via `firstValueFrom(... .pipe(toArray()))` (or `lastValueFrom` for the final emission), then assert filesystem state with `stat` / `readFileSync`. See `flattenOutput.test.ts` and `deleteFilesByExtension.test.ts` for the canonical shape.

Errors swallowed by `catchNamedError` complete the observable as `EMPTY` rather than rejecting — assert `emissions).toEqual([])` and use `captureConsoleMessage('error', ...)` to capture the logged reason.

### Hono route tests (in-process)

Each sub-app (e.g. `jobRoutes`, `queryRoutes`) is an `OpenAPIHono` instance — exercise it directly with `subApp.request(url, init)`; no real HTTP server needed. See `src/api/routes/jobRoutes.test.ts` (in-memory state via `jobStore`, reset in `afterEach`) and `src/api/routes/queryRoutes.test.ts` (filesystem-backed routes seeded with `vol.fromJSON`) for examples. POST helper:

```ts
const post = (path: string, body: unknown) => subApp.request(path, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})
```

Query routes that wrap filesystem / network calls return `{ ..., error: string | null }` at HTTP 200 instead of 500-ing — assert on `body.error`, not on `response.status`.

### Browser-driven tests (Playwright Test)

- Framework: `@playwright/test`. Tests live in `e2e/*.spec.ts`.
- Run headless once: `yarn e2e`. Run interactively: `yarn e2e:ui` (opens Playwright's UI mode for stepping through).
- `playwright.config.ts` boots `yarn api-server` automatically before tests run; in dev it reuses an already-running server, in CI it starts a fresh one.
- The first run requires `yarn install-playwright-browser` to fetch the Chromium binary.
- For tests that depend on backend data (search/lookup/listDirectoryEntries), use `page.route('**/queries/<endpoint>', ...)` to stub the network rather than hitting real services. See the path-typeahead test in `e2e/builder.spec.ts` for the pattern.
- Generated artifacts (`playwright-report/`, `test-results/`) are gitignored.

## API (`src/api/`)

Split into focused modules:

| File | Responsibility |
|------|---------------|
| `types.ts` | `Job` and `JobStatus` types |
| `jobStore.ts` | In-memory job state — all updates via exported functions |
| `logCapture.ts` | `AsyncLocalStorage`-based console routing; call `installLogCapture()` once at startup |
| `jobRunner.ts` | `runJob(jobId, observable)` — sets status, wires SSE subject |
| `routes/jobs.ts` | `GET /jobs`, `GET /jobs/:id` |
| `routes/logs.ts` | `GET /jobs/:id/logs` (SSE) |
| `routes/commands.ts` | `POST /jobs/<command>` endpoints |
| `index.ts` | Assembles the Hono app (no `serve()` call) |

`src/api.ts` is the entry point: imports the assembled app from `src/api/index.ts`
and calls `serve()`.

## Adding a new command

1. Create `src/<commandName>.ts` returning `Observable<unknown>`
2. Create `src/cli-commands/<commandName>.ts` using the `CommandModule` pattern (see below)
3. Import and `.command(...)` the module in `src/cli.ts`
4. Add a `app.post("/jobs/<commandName>", ...)` handler to `src/api/routes/commands.ts`

## Sequence Runner DSL

External API consumers should read the **Sequence Runner** section of [README.md](README.md) — that's the source of truth for how `paths`, `'@pathId'`, `linkedTo`/`output`, and the `/sequences/run` endpoint compose. The implementation lives in [src/api/resolveSequenceParams.ts](src/api/resolveSequenceParams.ts), [src/api/sequenceRunner.ts](src/api/sequenceRunner.ts), [src/api/routes/sequenceRoutes.ts](src/api/routes/sequenceRoutes.ts), and the per-command `extractOutputs` / `outputFolderName` / `outputComputation` declarations in [src/api/routes/commandRoutes.ts](src/api/routes/commandRoutes.ts). The canonical multi-step example is [examples/process-anime-subtitles.yaml](examples/process-anime-subtitles.yaml).

## CLI command modules (`src/cli-commands/`)

Each yargs command lives in its own file. The pattern uses `InferArgvOptions<T>` to
extract the plain options type from the builder, avoiding the `[key: string]: unknown`
index signature that `Awaited<ReturnType<typeof builder>>["argv"]` would produce:

```typescript
import type { Argv, CommandBuilder, CommandModule } from "yargs"
import { someCommand } from "../someCommand.js"

type InferArgvOptions<T> = T extends Argv<infer U> ? U : never

const builder = (yargs: Argv) => (
  yargs
  .positional("sourcePath", { demandOption: true, type: "string", describe: "..." })
  .option("isRecursive", { alias: "r", boolean: true, default: false, nargs: 0, type: "boolean", describe: "..." })
)

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const someCommandCommand: CommandModule<{}, Args> = {
  command: "someCommand <sourcePath>",
  describe: "...",
  builder: builder as CommandBuilder<{}, Args>,
  handler: (argv) => {
    someCommand({ isRecursive: argv.isRecursive, sourcePath: argv.sourcePath })
    .subscribe(() => { console.timeEnd("Command Runtime") })
  },
}
```

In `cli.ts`, register it with `.command(someCommandCommand)`.

## Multi-agent workflow

This repo can be cloned into sibling working trees named `media-tools-worker-<name>/` so several Claudes can work in parallel without stepping on each other. **Identify your role from your repo's folder name:**

- **Primary** (`media-tools/`, no suffix): you're the canonical Claude. `master` lives here; worker trees clone from it. Existing push rule applies unchanged: do NOT push to `master` unless the user explicitly says so. Because nothing leaves the local repo until the user asks, **commit-as-you-go is the safeguard** — each logical group must land in its own commit so unpushed work is never sitting in the working tree as a single uncommitted blob the user can't recover.
- **Worker** (`media-tools-worker-<name>/`): you're the worker named `<name>`. Work happens on a feature branch and is pushed continuously, not held until the user asks.

### Worker workflow

If your repo folder name starts with `media-tools-worker-`:

1. **Create a feature branch** at the start of any non-trivial work — don't commit directly to `master`. Naming: `feature/<short-description>` (e.g. `feature/jobs-progress-followup`). If a feature branch is already checked out and matches the task, keep using it.
2. **Commit AND push** to that branch as you go. This is the explicit reversal of the primary's "never push" rule — the push is what makes your work visible to the user and lets the primary (and other workers) see what you're up to. Push after every commit; don't batch.
3. **Don't merge to `master` autonomously.** Wait for the user to explicitly say "merge it" or equivalent. Once told, merge your feature branch into local `master` and push.
4. Everything in `Commit conventions` below (commit-as-you-go, partial-file splits, focused commits) still applies — you're just additionally pushing the branch on every commit.
5. **For UI changes, leave a dev server running when you hand off / open the PR.** The user reviews UI before approving — they can't tell from a diff whether a button morphs, whether copy feedback flashes, or whether a popover aligns. Start `yarn api-dev-server` (it picks up `PORT` from `.env` — never inline-override it with `$env:PORT=...`) in the background before announcing the PR, and tell the user the URL (`http://localhost:<PORT>/builder/` or `/`) so they can poke at it. Stop the server when they say they're done or when you merge.

The push-as-you-go rule is what keeps multiple workers from drifting into each other's blast radius — when the user can see all branches at once, conflicts get spotted early instead of at merge time.

**After any `git pull`** (in either repo, primary or worker): if the pull touched `package.json` or `yarn.lock`, run `yarn install` before doing anything else. Skipping this gives confusing "module not found" or "wrong version" failures that look like real bugs but are just stale `node_modules`. Quick check: `git diff HEAD@{1} HEAD -- package.json yarn.lock` shows whether the pull moved either.

## Worktree workflow

When working in a git worktree (created with `EnterWorktree`):

1. **Commit as you go** — after each logical group of changes and passing tests, create a commit. Don't batch work into a single commit at the end.
2. **Push to a PR, don't merge** — when all work is complete and tests pass, push changes to a GitHub PR and wait for the user to review. Do not merge autonomously; the user will review the PR and tell you when to merge.
3. **Start a dev server when ready for testing** — once the PR is created and ready for review, start `yarn api-dev-server` on a random port (it picks up `PORT` from `.env`). This allows the user to test the changes in their browser before approving.
4. **Kill the server after merge** — once the user tells you to merge and the merge is complete, stop the dev server.

The user will review changes by examining the PR and testing the running server, then explicitly ask you to merge when ready.

## Commit conventions

Commit *as you go*, not at the end of the session. After each logical group of changes lands and tests pass, commit it — one phase at a time. Don't batch a multi-step task into a single end-of-session commit just because the work all happened in one conversation; the user reviews incrementally, and a single 10-file commit is much harder to read than three focused 3-file commits.

If a single file legitimately touches two unrelated concerns (e.g. a feature change and an infrastructure fix in the same route file), keep them in separate commits — use `git add -p` to selectively stage hunks, or temporarily revert one set with the Edit tool, commit the other, then re-apply. Mixing is the wrong shortcut.

Natural commit points: a todo item flips to completed, a phase of a Plan-mode plan finishes, tests pass for a self-contained change, a refactor wraps up before the next one starts.

Push rule depends on which role you are — see `Multi-agent workflow` above. Primary: never push without explicit instruction. Worker: push every commit to your feature branch; only merge to `master` when told.

## makeDirectory

`makeDirectory(directoryPath)` always creates the exact path passed to it using `mkdir(..., { recursive: true })`. Callers that have a **file** path must pass `dirname(filePath)` themselves — `makeDirectory` does not strip the filename. This applies to `getAudioOffset.ts` and `reorderTracksFfmpeg.ts`; callers like `copyFiles.ts` and `splitChaptersFfmpeg.ts` already pass directory paths and need no wrapping.

## Commands that read `process.stdin`

`nameAnimeEpisodes` and `nameTvShowEpisodes` historically prompted via stdin to pick a search result. They now accept an optional `malId` / `tvdbId` parameter that bypasses stdin entirely. Always supply these IDs when calling these commands from the API or sequence builder — omitting them will hang waiting for stdin input.
