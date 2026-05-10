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

1. Create `src/<commandName>.ts` returning `Observable<unknown>`
2. Create `src/cli-commands/<commandName>.ts` using the `CommandModule` pattern (see below)
3. Import and `.command(...)` the module in `src/cli.ts`
4. Add a `app.post("/jobs/<commandName>", ...)` handler to `src/api/routes/commands.ts`

## Sequence Runner DSL

External API consumers should read the **Sequence Runner** section of [README.md](../../README.md) — that's the source of truth for how `paths`, `'@pathId'`, `linkedTo`/`output`, and the `/sequences/run` endpoint compose. The implementation lives in:
- [src/api/resolveSequenceParams.ts](../../packages/server/src/api/resolveSequenceParams.ts)
- [src/api/sequenceRunner.ts](../../packages/server/src/api/sequenceRunner.ts)
- [src/api/routes/sequenceRoutes.ts](../../packages/server/src/api/routes/sequenceRoutes.ts)
- [src/api/routes/commandRoutes.ts](../../packages/server/src/api/routes/commandRoutes.ts) — per-command `extractOutputs` / `outputFolderName` / `outputComputation` declarations

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

## makeDirectory

`makeDirectory(directoryPath)` always creates the exact path passed to it using `mkdir(..., { recursive: true })`. Callers that have a **file** path must pass `dirname(filePath)` themselves — `makeDirectory` does not strip the filename. This applies to `getAudioOffset.ts` and `reorderTracksFfmpeg.ts`; callers like `copyFiles.ts` and `splitChaptersFfmpeg.ts` already pass directory paths and need no wrapping.

## Commands That Read `process.stdin`

`nameAnimeEpisodes` and `nameTvShowEpisodes` historically prompted via stdin to pick a search result. They now accept an optional `malId` / `tvdbId` parameter that bypasses stdin entirely. Always supply these IDs when calling these commands from the API or sequence builder — omitting them will hang waiting for stdin input.
