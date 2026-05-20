# Architecture & Design Patterns

## Package Manager

**Always use `yarn`, never `npm` or `npx`.** The repo's lockfile is `yarn.lock`; running `npm install` or `npx` desynchronizes it.

- Install/add a package: `yarn add <pkg>` or `yarn add -D <pkg>`
- Install in a specific workspace: `yarn workspace <workspace-name> add <pkg>`
- Run scripts: `yarn <script>` (e.g. `yarn test`, `yarn build`)
- One-off executables: `yarn dlx <pkg>` — not `npx <pkg>`

## Observable-First

Every command module returns an `Observable`. Errors are handled via `catchNamedError`
(which logs via `console.error` and returns `EMPTY` — they do not surface as observable
errors to the subscriber).

## Pure Functions / No Direct Mutation

State updates must go through store functions that return new objects (spread-based).
Do not mutate object properties directly (e.g. `job.status = "x"` is wrong;
use `updateJob(id, { status: "x" })` instead).

## No `process.exit()` in Modules

`process.exit()` belongs only in `src/cli.ts` handlers. Any `tap(() => process.exit())`
in module files must be removed before those modules can be used in the API.

## API Architecture (`src/api/`)

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

## Adding a New Command

A command needs to land on **five** surfaces or it won't be fully usable. Missing any one of them silently drops a different mode of access — a route-only command isn't callable from the builder; a builder-only command isn't callable from the CLI. Touch every one in the same PR.

1. **App-command (Observable)** — `packages/core/src/app-commands/<commandName>.ts` (+ `.test.ts`). Returns `Observable<...>`; mirror an existing command like [flattenOutput.ts](../../packages/core/src/app-commands/flattenOutput.ts) for the AbortController + progress-emitter pattern.
2. **CLI adapter** — `packages/cli/src/cli-commands/<commandName>Command.ts` (yargs `CommandModule`). Then import and `.command(<name>Command)` it in `packages/cli/src/cli.ts`.
3. **HTTP route + commandName entry** — `packages/api/src/api/routes/commandRoutes.ts`: add the import, append `"<commandName>"` to the `commandNames` array, and add a registry entry to `commandConfigs` with `getObservable`, `schema`, `summary`, `tags`, plus optional `extractOutputs` / `outputFolderName` / `outputComputation`.
4. **Zod request schema** — `packages/api/src/api/schemas.ts`: export `<commandName>RequestSchema` with `.describe()` text on every field (the per-field describe drives the builder's hover tooltips via the regenerated `command-descriptions.js`). Schemas are re-exported automatically via `@mux-magic/api/api-schemas` for the web side.
5. **Web builder UI registry — TWO files, both required:**
    - `packages/web/src/commands/commands.ts` — add an entry to the `COMMANDS` map keyed by `<commandName>` with `tag`, `outputFolderName`, and `fields` (built via `fieldBuilder(<commandName>RequestSchema)`). **The CommandPicker iterates over this map — without an entry here, the command does not appear in the builder sidebar even though it's callable via HTTP and CLI.**
    - `packages/web/src/jobs/commandLabels.ts` — add a display label. Without it the sidebar shows the raw camelCase name.

Then regenerate the auto-built UI metadata: `yarn build:command-descriptions` rewrites `packages/web/public/command-descriptions.js` from the Zod `.describe()` text. Commit the regenerated file.

**Sanity check before opening the PR:** `grep -rn "flattenOutput\|moveFiles" packages/ docs/` — pick an established command and confirm your new command appears in every place the established one does. This is the single most reliable way to catch a missed wiring site (e.g. the `commands.ts` UI registry, which is easy to miss because there's no compile-time link between it and the server-side `commandNames` array).

## Sequence Runner DSL

External API consumers should read the **Sequence Runner** section of [MANIFEST.md](../../MANIFEST.md) — that's the source of truth for how `paths`, `'@pathId'`, `linkedTo`/`output`, and the `/sequences/run` endpoint compose. The implementation lives in:
- [src/api/resolveSequenceParams.ts](../../packages/api/src/api/resolveSequenceParams.ts)
- [src/api/sequenceRunner.ts](../../packages/api/src/api/sequenceRunner.ts)
- [src/api/routes/sequenceRoutes.ts](../../packages/api/src/api/routes/sequenceRoutes.ts)
- [src/api/routes/commandRoutes.ts](../../packages/api/src/api/routes/commandRoutes.ts) — per-command `extractOutputs` / `outputFolderName` / `outputComputation` declarations

The canonical multi-step example is [examples/process-anime-subtitles.yaml](../../examples/process-anime-subtitles.yaml).

## CLI Command Modules (`src/cli-commands/`)

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

export const someCommandCommand: CommandModule<Record<string, unknown>, Args> = {
  command: "someCommand <sourcePath>",
  describe: "...",
  builder: builder as CommandBuilder<Record<string, unknown>, Args>,
  handler: (argv) => {
    someCommand({ isRecursive: argv.isRecursive, sourcePath: argv.sourcePath })
    .subscribe(() => { console.timeEnd("Command Runtime") })
  },
}
```

In `cli.ts`, register it with `.command(someCommandCommand)`.

## makeDirectory

`makeDirectory(directoryPath)` always creates the exact path passed to it using `mkdir(..., { recursive: true })`. Callers that have a **file** path must pass `dirname(filePath)` themselves — `makeDirectory` does not strip the filename. This applies to `getAudioOffset.ts` and `reorderTracksFfmpeg.ts`; callers like `copyFiles.ts` and `splitChaptersFfmpeg.ts` already pass directory paths and need no wrapping.

## Commands That Read `process.stdin`

`nameAnimeEpisodes` and `nameTvShowEpisodes` historically prompted via stdin to pick a search result. They now accept an optional `malId` / `tvdbId` parameter that bypasses stdin entirely. Always supply these IDs when calling these commands from the API or sequence builder — omitting them will hang waiting for stdin input.
