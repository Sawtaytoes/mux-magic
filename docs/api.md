# REST API

The API runs long-running commands as background **jobs** and streams their output over SSE.

## Start the server

```sh
yarn dev                                       # default port 3000
PORT=8080 yarn dev                             # custom port
```

The API is mounted under `/api` (e.g. `http://localhost:3000/api/version`). Worker 29 collapsed the SPA + API onto one origin; all `curl` examples below include the `/api` prefix.

---

## Job lifecycle

1. `POST /commands/<command>` — creates a job, starts it immediately, returns `{ jobId, logsUrl, outputFolderName }` with HTTP 202. **The path is `/commands/…`, not `/jobs/…`** — jobs are only ever *read* under `/jobs`. Posting to `/jobs/<command>` does not 404: it falls through to the SPA and returns the app's `index.html` with HTTP 200, so a wrong path looks like a broken API rather than a bad URL.
2. `GET /jobs/:id/logs` — SSE stream. Each event is JSON:
   - `{ "line": "..." }` — a log line from stdout/stderr.
   - `{ "type": "progress", ... }` — progress snapshot.
   - `{ "type": "prompt", "promptId": "...", "message": "...", "options": [...] }` — the command needs the caller to choose something before it can continue (see [Interactive prompts](#interactive-prompts)).
   - `{ "isDone": true, "status": "completed" | "failed" | "cancelled" | "exited", "results": [...], "outputs": {...}, "error": null }` — terminal event.
3. `GET /jobs/:id` — poll job state at any time.
4. `POST /jobs/:id/input` — answer a prompt so a `paused` job can continue.
5. `DELETE /jobs/:id` — cancel a running job. Tears down the RxJS subscription and tree-kills the child process(es). Idempotent: 202 with the cancelled job body when actioned, 204 No Content when the job is already in a terminal state, 404 when the id is unknown.

### Job object shape

```json
{
  "id": "abc-123",
  "commandName": "keepLanguages",
  "params": { "sourcePath": "/media/anime", "...": "..." },
  "status": "pending | running | paused | completed | failed | cancelled | skipped | exited",
  "pauseReason": null,
  "logs": ["line 1", "line 2"],
  "results": [],
  "startedAt": "2026-01-01T00:00:00.000Z",
  "completedAt": "2026-01-01T00:01:00.000Z",
  "error": null,
  "outputs": null,
  "outputFolderName": null,
  "parentJobId": null,
  "stepId": null,
  "threadCountClaim": null
}
```

The command name field is `commandName`, not `command`.

`outputFolderName` is the subfolder a command writes into when it produces new files (`keepLanguages` → `LANGUAGE-TRIMMED`), and `null` for commands that edit in place. `parentJobId` and `stepId` are set on the child jobs of a sequence run.

`outputs` is populated when a command publishes named runtime values (see the [Sequence Runner](#sequence-runner) section below). Most commands leave it `null`.

---

## Endpoints

### Job management

| Method | Path | Description |
|---|---|---|
| `GET` | `/jobs` | List all jobs (logs excluded from response). |
| `GET` | `/jobs/status-counts` | Job counts per status — what the Jobs view's filter chips read. |
| `GET` | `/jobs/stream` | SSE stream of job state changes across all jobs. `?status=running,failed` filters which are replayed on connect. |
| `GET` | `/jobs/:id` | Get a single job including its buffered logs. |
| `GET` | `/jobs/:id/logs` | SSE stream of log lines and a final done event. |
| `POST` | `/jobs/:id/input` | Answer a prompt from a `paused` job. Body `{ promptId, selectedIndex }`; `selectedIndex: -1` skips. |
| `DELETE` | `/jobs/:id` | Cancel a running job. |

### Job commands

All commands are started with `POST`. The body is JSON. `sourcePath` is required for all commands that take it.

| Path | Required body fields | Optional body fields |
|---|---|---|
| `POST /commands/addSubtitles` | `sourcePath`, `subtitlesPath` | `hasChapterSyncOffset`, `globalOffset`, `includeChapters`, `offsets`[] |
| `POST /commands/analyseDiscBackup` | `sourcePath` | `disabledRuleNames`[], `minimumTitleLengthSeconds` |
| `POST /commands/changeTrackLanguages` | `sourcePath` | `isRecursive`, `audioLanguage`, `subtitlesLanguage`, `videoLanguage` |
| `POST /commands/convertContainerAudioToFlac` | `sourcePath` | `isRecursive`, `isSourceDeleted`, `isVideoDropAcknowledged` |
| `POST /commands/convertLosslessToFlac` | `sourcePath` | `isRecursive`, `recursiveDepth`, `isSourceDeleted`, `isAuditOnly` |
| `POST /commands/copyFiles` | `sourcePath` | `destinationPath`, `fileFilterRegex`, `folderFilterRegex`, `includeFolders`, `renameRegex`[], `allowOverwrite` |
| `POST /commands/copyOutSubtitles` | `sourcePath` | `isRecursive`, `subtitlesLanguages`[], `typesMode`, `subtitleTypes`[], `folders`[] |
| `POST /commands/deleteCopiedOriginals` | `pathsToDelete`[] | — |
| `POST /commands/deleteFilesByExtension` | `sourcePath`, `extensions`[] | `isRecursive`, `recursiveDepth` |
| `POST /commands/deleteFolder` | `sourcePath`, `confirm` | — |
| `POST /commands/distributeFolderToSiblings` | `sourceFolderPath` | `deleteSourceFolderAfterDistributing` |
| `POST /commands/exitIfEmpty` | `sourcePath` | — |
| `POST /commands/extractDiscTitles` | `sourcePath` | `destinationPath`, `disabledRuleNames`[], `minimumTitleLengthSeconds`, `titleIndexes`[], `isRippingTrackSupersets` |
| `POST /commands/extractSubtitles` | `sourcePath` | `isRecursive`, `subtitlesLanguages`[], `typesMode`, `subtitleTypes`[], `folders`[] |
| `POST /commands/findContainerAudioFiles` | `sourcePath` | `isRecursive` |
| `POST /commands/fixIncorrectDefaultTracks` | `sourcePath` | `isRecursive` |
| `POST /commands/flattenChildFolders` | `parentPath` | `deleteEmptyChildFoldersAfterFlattening` |
| `POST /commands/flattenOutput` | `sourcePath` | `deleteSourceFolder` |
| `POST /commands/getAudioOffsets` | `sourcePath`, `destinationFilesPath` | `isOverwritingExtractedAudio` |
| `POST /commands/hasBetterAudio` | `sourcePath` | `isRecursive`, `recursiveDepth` |
| `POST /commands/hasBetterVersion` | `sourcePath` | `isRecursive`, `recursiveDepth` |
| `POST /commands/hasDuplicateMusicFiles` | `sourcePath` | `isRecursive`, `recursiveDepth` |
| `POST /commands/hasImaxEnhancedAudio` | `sourcePath` | `isRecursive` |
| `POST /commands/hasManyAudioTracks` | `sourcePath` | `isRecursive` |
| `POST /commands/hasSurroundSound` | `sourcePath` | `isRecursive`, `recursiveDepth` |
| `POST /commands/hasWrongDefaultTrack` | `sourcePath` | `isRecursive` |
| `POST /commands/isMissingSubtitles` | `sourcePath` | `isRecursive` |
| `POST /commands/keepLanguages` | `sourcePath` | `isRecursive`, `audioLanguages`[], `subtitlesLanguages`[], `useFirstAudioLanguage`, `useFirstSubtitlesLanguage` |
| `POST /commands/makeDirectory` | `sourcePath` | — |
| `POST /commands/mergeTracks` | `sourcePath`, `subtitlesPath` | `hasChapterSyncOffset`, `globalOffset`, `includeChapters`, `offsets`[] |
| `POST /commands/modifySubtitleMetadata` | `sourcePath` | `isRecursive`, `recursiveDepth`, `hasDefaultRules`, `predicates`, `rules`[] |
| `POST /commands/moveFiles` | `sourcePath` | `destinationPath`, `fileFilterRegex`, `renameRegex`[], `allowOverwrite` |
| `POST /commands/moveFilesIntoNamedFolders` | `sourcePath` | — |
| `POST /commands/nameAnimeEpisodes` | `sourcePath` | `searchTerm`, `seasonNumber`, `malId` |
| `POST /commands/nameAnimeEpisodesAniDB` | `sourcePath` | `searchTerm`, `seasonNumber`, `anidbId`, `episodeType`, `filenameRegex`, `startEpisodeNumber`, `seriesName` |
| `POST /commands/nameMovieCutsDvdCompareTmdb` | `sourcePath` | `url`, `dvdCompareId`, `dvdCompareReleaseHash`, `searchTerm`, `fixedOffset`, `timecodePadding` |
| `POST /commands/nameSpecialFeaturesDvdCompareTmdb` | `sourcePath` | `url`, `dvdCompareId`, `dvdCompareReleaseHash`, `searchTerm`, `fixedOffset`, `timecodePadding`, `moveToEditionFolders`, `nonInteractive`, `autoNameDuplicates` |
| `POST /commands/nameTvShowEpisodes` | `sourcePath` | `searchTerm`, `seasonNumber`, `tvdbId` |
| `POST /commands/onlyNameSpecialFeaturesDvdCompare` | `sourcePath` | `dvdCompareId`, `dvdCompareReleaseHash`, `url`, `searchTerm`, `timecodePadding`, `fixedOffset`, `autoNameDuplicates` |
| `POST /commands/remuxToMkv` | `sourcePath`, `extensions`[] | `isRecursive`, `recursiveDepth`, `isSourceDeletedOnSuccess` |
| `POST /commands/renameDemos` | `sourcePath` | `isRecursive` |
| `POST /commands/renameFiles` | `sourcePath`, `renameRegex`[] | `isRecursive`, `recursiveDepth`, `fileFilterRegex` |
| `POST /commands/renameMovieClipDownloads` | `sourcePath` | — |
| `POST /commands/renumberChapters` | `sourcePath` | `isRecursive`, `isPaddingChapterNumbers` |
| `POST /commands/reorderTracks` | `sourcePath` | `isRecursive`, `videoTrackIndexes`[], `audioTrackIndexes`[], `subtitlesTrackIndexes`[], `isSkipOnTrackMisalignment` |
| `POST /commands/replaceAttachments` | `sourcePath`, `destinationFilesPath` | — |
| `POST /commands/replaceFlacWithPcmAudio` | `sourcePath` | `isRecursive` |
| `POST /commands/replaceTracks` | `sourcePath`, `destinationFilesPath` | `hasAudioSyncOffset`, `globalOffset`, `includeChapters`, `isOverwritingExtractedAudio`, `audioLanguages`[], `subtitlesLanguages`[], `videoLanguages`[], `offsets`[] |
| `POST /commands/setDisplayWidth` | `sourcePath` | `isRecursive`, `recursiveDepth`, `displayWidth` |
| `POST /commands/splitChapters` | `sourcePath`, `chapterSplits`[] | `isRenumberingChapters`, `isPaddingChapterNumbers` |
| `POST /commands/splitCueSheet` | `sourcePath` | `isRecursive`, `outputFolderName` |
| `POST /commands/storeAspectRatioData` | `sourcePath` | `isRecursive`, `recursiveDepth`, `outputPath`, `rootPath`, `folders`[], `force` |
| `POST /commands/trimFileTail` | `sourcePath`, `fileName`, `endTime` | — |

> **Not yet available via API:** `inverseTelecineDiscRips`, `mergeOrderedChapters`. (`copyOutSubtitles` and `getAudioOffsets` used to be listed here and are now exposed.)

### Interactive prompts

Some commands cannot finish unattended. `nameTvShowEpisodes` and the `*DvdCompare*` naming
commands stop and ask the caller to pick a match. When that happens the job goes to
`status: "paused"` with `pauseReason: "user_input"`, and a `prompt` event goes out on that
job's SSE stream:

```json
{ "type": "prompt", "promptId": "p-1", "message": "Which series?", "options": ["The Odyssey (1997)", "..."], "filePath": "/media/…" }
```

Answer it with the `promptId` from that event:

```sh
curl -s -X POST http://localhost:3000/api/jobs/abc-123/input \
  -H "Content-Type: application/json" \
  -d '{"promptId":"p-1","selectedIndex":0}'
```

`selectedIndex: -1` skips the item and leaves it unrenamed.

> ⚠️ **Subscribe to the log stream before you POST the command, and keep it open.**
> `GET /jobs/:id/logs` replays buffered log lines and step-lifecycle events on connect,
> but it does **not** replay a prompt that is already pending. A caller that starts a job,
> notices `status: "paused"`, and only then opens the stream never receives the `prompt`
> event — so it never learns the `promptId`, and the job cannot be answered at all. From a
> script the job is then stuck: the only ways out are `DELETE /jobs/:id`, or answering it
> in the web UI, which holds its own long-lived stream. Non-interactive callers should
> prefer the deterministic commands (`renameFiles` / `moveFiles` with a `renameRegex`)
> over the prompting naming commands.

### Browser-safe audio playback

The Builder's file-explorer modal includes a `<video>` preview that plays files directly via `GET /files/stream`. For most rips the audio decodes fine, but disc rips often carry codecs no browser can decode (DTS, TrueHD, MLP, AC-3 outside of Edge, EAC-3 outside of Apple devices). To avoid silent video, the modal probes the source's audio codec via `GET /files/audio-codec?path=…` and, when needed, automatically swaps `<video>.src` to `GET /transcode/audio?path=…&codec=opus`. That endpoint re-encodes only the audio (video stream is `-c:v copy`, so no GPU is involved) and serves the result as Opus in fragmented MP4 (AAC in fMP4 as the fallback) with HTTP Range support.

**The transcode endpoint requires media to be mounted at `/media` inside the server container.** The path-safety check is hardcoded — paths outside `/media` return 403. Mount the volume in your Docker Compose / run command:

```yaml
volumes:
  - /your/host/media-library:/media:ro
```

If the volume isn't mounted (or the file lives elsewhere), the modal falls back to the direct `/files/stream` path; you'll see video without audio for unsupported-codec sources, and the **Open in external app** fallback (VLC etc.) is always available as a last resort.

The transcode cache lives under `os.tmpdir()/media-tools-transcode-cache/` and is bounded at 4 GB by default — override via `TRANSCODE_CACHE_MAX_BYTES`. Concurrent encodes are gated at 4 by default — override via `MAX_TRANSCODE_CONCURRENCY`. Same-source-and-params requests coalesce onto one in-flight encode automatically.

---

## Example: start a job and stream its logs

```sh
# Start the job
curl -s -X POST http://localhost:3000/api/commands/keepLanguages \
  -H "Content-Type: application/json" \
  -d '{"sourcePath":"/media/anime","audioLanguages":["jpn"],"subtitlesLanguages":["eng"],"isRecursive":true}' \
| jq
# → { "jobId": "abc-123", "logsUrl": "/jobs/abc-123/logs", "outputFolderName": "LANGUAGE-TRIMMED" }

# Stream the output
curl -s http://localhost:3000/api/jobs/abc-123/logs
# data: {"line":"Processing file.mkv..."}
# data: {"line":"Done."}
# data: {"done":true,"status":"completed"}
```

---

## Sequence Runner

`POST /sequences/run` accepts a list of commands, runs them in order under a **single umbrella job**, and streams every step's output through one SSE log feed. Steps reference each other symbolically — a downstream step can consume an upstream step's output folder or a named runtime value without the caller hardcoding any paths or computing intermediate state.

This is the right endpoint to use whenever you'd otherwise script multiple `POST /commands/<command>` calls in sequence.

### Endpoint

```
POST /sequences/run
Content-Type: application/json
```

Body — one of:

- `{ "yaml": "<yaml string>" }` — server parses and validates.
- `{ "paths": {...}, "steps": [...] }` — pre-parsed JSON shape.

Response (`202`):

```json
{ "jobId": "abc-123", "logsUrl": "/jobs/abc-123/logs" }
```

The umbrella job's lifecycle is the same as any other (`GET /jobs/:id`, SSE at `/jobs/:id/logs`). It flips to `failed` on the first failed step and skips the remainder; otherwise it completes after every step finishes.

### Validate without running

```
POST /sequences/validate
Content-Type: application/json
```

Checks a sequence document **without starting a job or touching any files** — use it to verify a hand-written or generated sequence before `POST /sequences/run`. Accepts the same two body shapes (`{ "yaml": ... }` or a pre-parsed `{ "paths"/"variables", "steps" }`), but always responds `200` with:

```json
{ "isValid": false, "errors": [{ "stepId": "trimFeature", "command": "keepLanguages", "message": "sourcePath: Required" }] }
```

Two layers run: (1) the **envelope** schema (YAML parses; unique step ids; no `linkedTo` between parallel-group siblings; every `command` is known; `@ref` format) — the same schema `/sequences/run` applies before starting a job; and (2) **per-step params** — each step's `params`, after resolving `@pathId` variables and `{ linkedTo, output: 'folder' }` references, is validated against that command's request schema (the same check the runner does per step at execution time). Named step-output links (`{ linkedTo, output: <name> }`) can't be resolved without running, so they're treated as satisfied once the target step exists. `isValid` is `true` only when `errors` is empty.

Every command's request schema (and the sequence envelope schemas) are also machine-readable at `GET /openapi.json` (OpenAPI 3.1 = JSON Schema 2020-12), so a sequence can additionally be validated offline against that document.

### Document shape

```yaml
paths:
  <pathId>:
    label: <display label, optional>
    value: <literal filesystem path>

steps:
  - id: <stableStringId>
    command: <registered command name>
    params:
      <fieldName>: <literal | "@pathId" | { linkedTo, output }>
```

- **`paths`** is the only place where literal filesystem paths appear. Every step body references them symbolically.
- **`steps[].id`** is a stable string. If you omit it, the server auto-assigns `step1`, `step2`, …. It's the target of every `linkedTo` reference, so set explicit ids when you need to reference earlier steps.
- **`steps[].command`** must match a registered command. The full registry is exposed at `GET /doc` (OpenAPI). Unknown command names fail the umbrella job before any step runs.
- **`steps[].params`** values can take **three forms** — see below.

### The three param value forms

#### 1. Literal

Plain JSON value that matches the command's request schema.

```yaml
audioLanguages: [jpn]
isRecursive: true
recursiveDepth: 2
```

#### 2. Path-variable reference: `"@<pathId>"`

A string starting with `@` resolves to the matching path's `value` at runtime. **Quote it in YAML** — `@` is a reserved indicator at the start of a scalar.

```yaml
paths:
  workDir:
    value: 'D:\Anime\Show\__work'
steps:
  - id: filterLangs
    command: keepLanguages
    params:
      sourcePath: '@workDir'        # → 'D:\Anime\Show\__work'
```

#### 3. Step-output reference: `{ linkedTo, output }`

Resolves to a value the source step produced. There are two `output` flavors:

##### a) `output: folder` — synthesized output directory

Every command declares (or implies) where its writes land. For commands with an `outputFolderName` (e.g., `keepLanguages` writes into `<sourcePath>/LANGUAGE-TRIMMED`), `output: folder` resolves to that path. For `flattenOutput`, it resolves to `dirname(sourcePath)` (since flattenOutput copies up one level). For commands that have neither but do have a `destinationPath` / `destinationFilesPath`, that's used. This is the form you want **whenever a downstream step needs to operate on the previous step's output directory**.

```yaml
paths:
  workDir:
    value: 'D:\Anime\Show\__work'
steps:
  - id: filterLangs
    command: keepLanguages          # writes to <sourcePath>/LANGUAGE-TRIMMED
    params:
      sourcePath: '@workDir'
  - id: copyBack
    command: copyFiles
    params:
      sourcePath:
        linkedTo: filterLangs
        output: folder              # → '<workDir>/LANGUAGE-TRIMMED'
      destinationPath: '@workDir'
```

##### b) `output: <name>` — named runtime output

Some commands publish structured runtime values for downstream steps. Each such command declares its output schema; the value is captured when that command's job completes and made available to later steps. No commands currently expose named outputs other than the synthesized `folder`. Earlier versions had a `computeDefaultSubtitleRules` step whose `rules` named output flowed into `modifySubtitleMetadata`; that has been folded into `modifySubtitleMetadata`'s `hasDefaultRules: true` toggle (see [docs/dsl/subtitle-rules.md](dsl/subtitle-rules.md) `Default rules toggle`).

```yaml
steps:
  - id: applyRules
    command: modifySubtitleMetadata
    params:
      sourcePath: '@workDir'
      hasDefaultRules: true        # default heuristic prepended to rules
      rules: []                    # optional user overrides run after defaults
```

To discover which commands publish named outputs, hit `GET /doc` — every command's spec includes its outputs declaration.

### Resolution rules

- A step can only reference steps **earlier in the array**. Forward references error before the umbrella job starts.
- A reference to a missing path / step / output **fails the umbrella job** with a clear message in the SSE stream — there is no silent fallback.
- The synthesized `folder` output is computed from the source step's *resolved* params, so chains compose correctly across many steps.
- **There are no `if`/`when` predicates in the YAML.** Commands that should "skip when nothing to do" implement an empty-input no-op themselves. If you need conditional execution, build the YAML conditionally on the caller side.
- Empty arrays and `null` values pass through unchanged — they're not the same as "absent."

### Authoring YAML from another service

The OpenAPI spec at `GET /doc` is the source of truth. For each command you'll see:

1. **Request body schema** — what params the command accepts (literals, `@pathId`, or `{ linkedTo, output }` are all valid for any field).
2. **Output declarations** — `outputFolderName` (so `output: folder` resolves), and any named outputs declared via `extractOutputs`.

A useful pattern: have your service hold the higher-level configuration (e.g., "does this anime need track reordering?") and decide step inclusion on its side. Then serialize one YAML payload and POST it. The umbrella job's job id is your handle for everything that follows — log streaming, status polling, error surfacing.

### Worked example: anime subtitle pipeline

The repo ships [`examples/process-anime-subtitles.yaml`](../examples/process-anime-subtitles.yaml) — a complete multi-step pipeline that filters track languages, extracts subtitles, applies default subtitle modification rules in place via `modifySubtitleMetadata` with `hasDefaultRules: true`, re-merges, copies the result up to the parent series folder, and cleans up the work directory. It's a dense reference for path-vars + folder outputs together. A companion test at `examples/process-anime-subtitles.test.ts` validates the document and walks every link reference, so a regression in any command's metadata fails CI before the example silently rots.

### Minimal copy-paste example

```bash
curl -X POST http://localhost:3000/api/sequences/run \
  -H 'Content-Type: application/json' \
  -d '{
    "paths": {
      "workDir": { "value": "D:\\Anime\\Show\\__work" }
    },
    "steps": [
      {
        "id": "filterLangs",
        "command": "keepLanguages",
        "params": {
          "sourcePath": "@workDir",
          "audioLanguages": ["jpn"],
          "subtitlesLanguages": ["eng"]
        }
      },
      {
        "id": "copyBack",
        "command": "copyFiles",
        "params": {
          "sourcePath": { "linkedTo": "filterLangs", "output": "folder" },
          "destinationPath": "@workDir"
        }
      }
    ]
  }'
```

The response carries the job id; `curl -N http://localhost:3000/api/jobs/<jobId>/logs` tails the unified log stream.
