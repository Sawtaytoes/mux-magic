# REST API

The API runs long-running commands as background **jobs** and streams their output over SSE.

## Start the server

```sh
yarn server                                    # default port 3000
PORT=8080 yarn server                          # custom port
```

---

## Job lifecycle

1. `POST /jobs/<command>` — creates a job, starts it immediately, returns `{ jobId, logsUrl }` with HTTP 202.
2. `GET /jobs/:id/logs` — SSE stream. Each event is JSON:
   - `{ "line": "..." }` — a log line from stdout/stderr.
   - `{ "done": true, "status": "completed" | "failed" | "cancelled" }` — terminal event.
3. `GET /jobs/:id` — poll job state at any time.
4. `DELETE /jobs/:id` — cancel a running job. Tears down the RxJS subscription and tree-kills the child process(es). Idempotent: 202 with the cancelled job body when actioned, 204 No Content when the job is already in a terminal state, 404 when the id is unknown.

### Job object shape

```json
{
  "id": "abc-123",
  "command": "keepLanguages",
  "params": { "sourcePath": "/media/anime", "...": "..." },
  "status": "pending | running | completed | failed",
  "logs": ["line 1", "line 2"],
  "startedAt": "2026-01-01T00:00:00.000Z",
  "completedAt": "2026-01-01T00:01:00.000Z",
  "error": null,
  "outputs": null
}
```

`outputs` is populated when a command publishes named runtime values (see the [Sequence Runner](#sequence-runner) section below). Most commands leave it `null`.

---

## Endpoints

### Job management

| Method | Path | Description |
|---|---|---|
| `GET` | `/jobs` | List all jobs (logs excluded from response). |
| `GET` | `/jobs/:id` | Get a single job including its buffered logs. |
| `GET` | `/jobs/:id/logs` | SSE stream of log lines and a final done event. |

### Job commands

All commands are started with `POST`. The body is JSON. `sourcePath` is required for all commands that take it.

| Path | Required body fields | Optional body fields |
|---|---|---|
| `POST /jobs/changeTrackLanguages` | `sourcePath` | `audioLanguage`, `subtitlesLanguage`, `videoLanguage`, `isRecursive` |
| `POST /jobs/copyFiles` | `sourcePath`, `destinationPath` | — |
| `POST /jobs/fixIncorrectDefaultTracks` | `sourcePath` | `isRecursive` |
| `POST /jobs/hasBetterAudio` | `sourcePath` | `isRecursive`, `recursiveDepth` |
| `POST /jobs/hasBetterVersion` | `sourcePath` | `isRecursive`, `recursiveDepth` |
| `POST /jobs/hasDuplicateMusicFiles` | `sourcePath` | `isRecursive`, `recursiveDepth` |
| `POST /jobs/hasImaxEnhancedAudio` | `sourcePath` | `isRecursive` |
| `POST /jobs/hasManyAudioTracks` | `sourcePath` | `isRecursive` |
| `POST /jobs/hasSurroundSound` | `sourcePath` | `isRecursive`, `recursiveDepth` |
| `POST /jobs/hasWrongDefaultTrack` | `sourcePath` | `isRecursive` |
| `POST /jobs/isMissingSubtitles` | `sourcePath` | `isRecursive` |
| `POST /jobs/keepLanguages` | `sourcePath` | `audioLanguages[]`, `subtitlesLanguages[]`, `useFirstAudioLanguage`, `useFirstSubtitlesLanguage`, `isRecursive` |
| `POST /jobs/addSubtitles` | `subtitlesPath`, `sourcePath` | `offsets[]`, `hasChapterSyncOffset`, `globalOffset`, `includeChapters` |
| `POST /jobs/mergeTracks` | `subtitlesPath`, `sourcePath` | (DEPRECATED — alias of `addSubtitles`) `offsets[]`, `hasChapterSyncOffset`, `globalOffset`, `includeChapters` |
| `POST /jobs/moveFiles` | `sourcePath`, `destinationPath` | — |
| `POST /jobs/nameAnimeEpisodes` | `sourcePath`, `searchTerm` | `seasonNumber`, `malId` |
| `POST /jobs/nameAnimeEpisodesAniDB` | `sourcePath` | `searchTerm`, `seasonNumber`, `anidbId` (see [AniDB command notes](cli.md#anidb-command-notes)) |
| `POST /jobs/nameSpecialFeatures` | `sourcePath`, `url` | `fixedOffset`, `timecodePadding` |
| `POST /jobs/nameTvShowEpisodes` | `sourcePath`, `searchTerm`, `seasonNumber` | — |
| `POST /jobs/renameDemos` | `sourcePath` | `isRecursive` |
| `POST /jobs/renameMovieClipDownloads` | `sourcePath` | — |
| `POST /jobs/reorderTracks` | `sourcePath` | `audioTrackIndexes[]`, `subtitlesTrackIndexes[]`, `videoTrackIndexes[]`, `isRecursive` |
| `POST /jobs/replaceAttachments` | `sourceFilesPath`, `destinationFilesPath` | — |
| `POST /jobs/replaceFlacWithPcmAudio` | `sourcePath` | `isRecursive` |
| `POST /jobs/replaceTracks` | `sourceFilesPath`, `destinationFilesPath` | `audioLanguages[]`, `subtitlesLanguages[]`, `videoLanguages[]`, `offsets[]`, `hasChapterSyncOffset`, `globalOffset`, `includeChapters` |
| `POST /jobs/setDisplayWidth` | `sourcePath` | `displayWidth` (default 853), `isRecursive`, `recursiveDepth` |
| `POST /jobs/splitChapters` | `sourcePath`, `chapterSplits[]` | — |
| `POST /jobs/storeAspectRatioData` | `sourcePath` | `folders[]`, `force`, `isRecursive`, `recursiveDepth`, `outputPath`, `rootPath`, `threads` |

> **Not yet available via API:** `copyOutSubtitles`, `getAudioOffsets`, `inverseTelecineDiscRips`, `mergeOrderedChapters`.

### Browser-safe audio playback

The Builder's file-explorer modal includes a `<video>` preview that plays files directly via `GET /files/stream`. For most rips the audio decodes fine, but disc rips often carry codecs no browser can decode (DTS, TrueHD, MLP, AC-3 outside of Edge, EAC-3 outside of Apple devices). To avoid silent video, the modal probes the source's audio codec via `GET /files/audio-codec?path=…` and, when needed, automatically swaps `<video>.src` to `GET /transcode/audio?path=…&codec=opus`. That endpoint re-encodes only the audio (video stream is `-c:v copy`, so no GPU is involved) and serves the result as Opus-in-WebM with HTTP Range support.

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
curl -s -X POST http://localhost:3000/jobs/keepLanguages \
  -H "Content-Type: application/json" \
  -d '{"sourcePath":"/media/anime","audioLanguages":["jpn"],"subtitlesLanguages":["eng"],"isRecursive":true}' \
| jq
# → { "jobId": "abc-123", "logsUrl": "/jobs/abc-123/logs" }

# Stream the output
curl -s http://localhost:3000/jobs/abc-123/logs
# data: {"line":"Processing file.mkv..."}
# data: {"line":"Done."}
# data: {"done":true,"status":"completed"}
```

---

## Sequence Runner

`POST /sequences/run` accepts a list of commands, runs them in order under a **single umbrella job**, and streams every step's output through one SSE log feed. Steps reference each other symbolically — a downstream step can consume an upstream step's output folder or a named runtime value without the caller hardcoding any paths or computing intermediate state.

This is the right endpoint to use whenever you'd otherwise script multiple `POST /jobs/<command>` calls in sequence.

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
curl -X POST http://localhost:3000/sequences/run \
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

The response carries the job id; `curl -N http://localhost:3000/jobs/<jobId>/logs` tails the unified log stream.
