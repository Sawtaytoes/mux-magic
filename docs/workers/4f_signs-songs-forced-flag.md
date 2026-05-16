# Worker 4f — signs-songs-forced-flag

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/4f-signs-songs-forced-flag`
**Worktree:** `.claude/worktrees/4f_signs-songs-forced-flag/`
**Phase:** 5
**Depends on:** 01
**Parallel with:** any Phase 5 worker that doesn't touch [packages/server/src/api/schemas.ts](../../packages/server/src/api/schemas.ts), [packages/server/src/api/routes/commandRoutes.ts](../../packages/server/src/api/routes/commandRoutes.ts), [packages/web/src/commands/commands.ts](../../packages/web/src/commands/commands.ts), or [packages/web/src/jobs/commandLabels.ts](../../packages/web/src/jobs/commandLabels.ts).

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your Mission

Add a new app-command — `setSignsSongsForcedFlag` — that scans the subtitle tracks of MKV files for track names matching a configurable "Signs & Songs" pattern set (`Signs & Songs`, `Signs/Songs`, `Signs and Songs`, `S&S`, `Signs`, `Songs`, etc., case-insensitive), and sets `flag-forced=1` on each matching track via `mkvpropedit --edit track:N --set flag-forced=1`. This is the standard convention for anime/foreign-language releases where signs and songs are localized but full dialogue is not — players honoring forced flags will auto-display these even when the user's preferred subtitle language is set to "off".

### Shape to mirror

[packages/server/src/app-commands/fixIncorrectDefaultTracks.ts](../../packages/server/src/app-commands/fixIncorrectDefaultTracks.ts) is the canonical "per-file, mutate via mkvpropedit" pipeline. Copy its structure beat-for-beat:

- `getFilesAtDepth` → `filterIsVideoFile` → `withFileProgress(...)` → emit a per-file `{ filePath, modificationCount }` record → `logAndRethrowPipelineError(setSignsSongsForcedFlag)`.
- The per-file inner pipeline runs a single mutator (in `fixIncorrectDefaultTracks` that's `setOnlyFirstTracksAsDefault`; here it's a new `setSignsSongsForcedFlagOnTracks`) and uses `toArray()` so the outer pipeline gets one emission per file regardless of how many tracks were touched.

### Detection + mutation algorithm

1. For each MKV under `sourcePath`, call `getMkvInfo` ([packages/server/src/tools/getMkvInfo.ts](../../packages/server/src/tools/getMkvInfo.ts)) to read the track list.
2. Filter to subtitle tracks (`type === "subtitles"` / `codec_id` starting with `S_`).
3. For each subtitle track, test its track name (`properties.track_name` — confirm the exact field by reading the existing track schema in `getMkvInfo.ts`) against the configurable pattern list. Match is **case-insensitive** and treats `&`/`/`/`and` as equivalent connectors via a small normalizer.
4. For each matching track, invoke `runMkvPropEdit` ([packages/server/src/cli-spawn-operations/runMkvPropEdit.ts](../../packages/server/src/cli-spawn-operations/runMkvPropEdit.ts)) with args `["--edit", `track:${trackNumber}`, "--set", "flag-forced=1"]`. Group multiple track flags into a single invocation if more than one matches in the same file (mkvpropedit accepts repeated `--edit ... --set ...` pairs).
5. Skip the file (no mutation, no error) when zero subtitle tracks match.
6. Emit `{ filePath, modificationCount }` per file (matching `fixIncorrectDefaultTracks`'s contract).

### Inputs

```ts
type SetSignsSongsForcedFlagProps = {
  isRecursive: boolean
  sourcePath: string
  signsSongsNamePatterns?: string[]
  // When true, an explicit `flag-forced=0` is set on every non-matching
  // subtitle track in the same file (defensive — prevents stale forced
  // flags on full-dialogue tracks). Default false.
  shouldClearOtherForcedFlags?: boolean
}
```

Defaults (export alongside the command):

```ts
export const setSignsSongsForcedFlagDefaultProps = {
  signsSongsNamePatterns: [
    "signs & songs",
    "signs/songs",
    "signs and songs",
    "s&s",
    "signs",
    "songs",
  ],
  shouldClearOtherForcedFlags: false,
} satisfies SetSignsSongsForcedFlagOptionalProps
```

The normalizer that compares track names against this list should: lowercase, collapse whitespace, treat ` & `, ` / `, ` and ` as the same separator, then substring-match.

### Wiring

Same six surfaces as every other app-command:

1. **App-command:** [packages/server/src/app-commands/setSignsSongsForcedFlag.ts](../../packages/server/src/app-commands/setSignsSongsForcedFlag.ts)
2. **Helper (cli-spawn-operations level):** [packages/server/src/cli-spawn-operations/setSignsSongsForcedFlagOnTracks.ts](../../packages/server/src/cli-spawn-operations/setSignsSongsForcedFlagOnTracks.ts) — mirrors `setOnlyFirstTracksAsDefault.ts`; takes `{ filePath, trackNumbers, shouldClearOtherForcedFlags }` and emits the per-track mutation events.
3. **Schema:** [packages/server/src/api/schemas.ts](../../packages/server/src/api/schemas.ts) — `setSignsSongsForcedFlagRequestSchema`. Field naming follows the `is`/`has`/`should` discipline (worker 05's eslint rule). `signsSongsNamePatterns` and `shouldClearOtherForcedFlags` are optional with defaults applied server-side.
4. **Route registration:** [packages/server/src/api/routes/commandRoutes.ts](../../packages/server/src/api/routes/commandRoutes.ts) — under the `Track Operations` tag (same tag as `fixIncorrectDefaultTracks`).
5. **Web command list:** [packages/web/src/commands/commands.ts](../../packages/web/src/commands/commands.ts) `fieldBuilder` block + the command name list.
6. **Label:** [packages/web/src/jobs/commandLabels.ts](../../packages/web/src/jobs/commandLabels.ts) → `Set Signs & Songs Forced Flag`.
7. **CLI wrapper:** [packages/cli/src/cli-commands/setSignsSongsForcedFlagCommand.ts](../../packages/cli/src/cli-commands/setSignsSongsForcedFlagCommand.ts) — mirror [fixIncorrectDefaultTracksCommand.ts](../../packages/cli/src/cli-commands/fixIncorrectDefaultTracksCommand.ts) (positional `sourcePath`, `-r`, optional `--patterns` repeatable, optional `--clear-other-forced`).

### Helper extraction discipline

If the pattern-normalizer grows past a few lines, extract a sibling `setSignsSongsForcedFlag.patterns.ts` next to the app-command (dotted-suffix sibling, no barrel — see project memory). The subtitle-track filter probably already lives in `filterIsSubtitleTrack` or similar under [packages/server/src/tools/](../../packages/server/src/tools/); reuse rather than reinvent.

### Fake-data scenario

Add [packages/server/src/fake-data/scenarios/setSignsSongsForcedFlag.ts](../../packages/server/src/fake-data/scenarios/setSignsSongsForcedFlag.ts) and register it in [packages/server/src/fake-data/index.ts](../../packages/server/src/fake-data/index.ts). Model on [replaceFlacWithPcmAudio.ts](../../packages/server/src/fake-data/scenarios/replaceFlacWithPcmAudio.ts) — emit progress events plus a small batch of per-file results so e2e and Storybook snapshots are deterministic.

## TDD steps

1. **Failing pattern-normalizer test** — covers separator equivalence (`&`/`/`/`and`), case-insensitivity, leading/trailing whitespace, and the "no match" path.
2. **Failing app-command test** — `setSignsSongsForcedFlag.test.ts` with `getMkvInfo` stubbed to return:
   - File with one "Signs & Songs" subtitle track → one `runMkvPropEdit` call with `track:N --set flag-forced=1`.
   - File with both "Signs/Songs" and "Full Subtitles" → only the first track is flagged; with `shouldClearOtherForcedFlags: true`, the second is explicitly `flag-forced=0`.
   - File with zero matching tracks → no `runMkvPropEdit` call; pipeline emits `{ filePath, modificationCount: 0 }`.
   - File with custom `signsSongsNamePatterns: ["typesetting"]` → flags only typesetting tracks.
3. **Failing schema test** — round-trips defaults, rejects empty `sourcePath`, accepts a custom `signsSongsNamePatterns` array.
4. **Failing route test** — POST to the new route with a fixture body and assert response shape.
5. Implement until green. Two commits (red, then green).
6. **Parity fixture** — `packages/web/tests/fixtures/parity/setSignsSongsForcedFlag.input.json` + `.yaml`.
7. **CLI smoke** — exercise the new CLI command against the fake-data scenario.
8. Standard gate: `yarn lint → typecheck → test → e2e → lint`.

## Files

### New

- [packages/server/src/app-commands/setSignsSongsForcedFlag.ts](../../packages/server/src/app-commands/setSignsSongsForcedFlag.ts)
- [packages/server/src/app-commands/setSignsSongsForcedFlag.test.ts](../../packages/server/src/app-commands/setSignsSongsForcedFlag.test.ts)
- [packages/server/src/cli-spawn-operations/setSignsSongsForcedFlagOnTracks.ts](../../packages/server/src/cli-spawn-operations/setSignsSongsForcedFlagOnTracks.ts)
- [packages/server/src/fake-data/scenarios/setSignsSongsForcedFlag.ts](../../packages/server/src/fake-data/scenarios/setSignsSongsForcedFlag.ts)
- [packages/cli/src/cli-commands/setSignsSongsForcedFlagCommand.ts](../../packages/cli/src/cli-commands/setSignsSongsForcedFlagCommand.ts)
- [packages/web/tests/fixtures/parity/setSignsSongsForcedFlag.input.json](../../packages/web/tests/fixtures/parity/setSignsSongsForcedFlag.input.json)
- [packages/web/tests/fixtures/parity/setSignsSongsForcedFlag.yaml](../../packages/web/tests/fixtures/parity/setSignsSongsForcedFlag.yaml)
- Optional: `packages/server/src/app-commands/setSignsSongsForcedFlag.patterns.ts` (dotted-suffix sibling, only if the normalizer grows)

### Extend

- [packages/server/src/api/schemas.ts](../../packages/server/src/api/schemas.ts) — `setSignsSongsForcedFlagRequestSchema`
- [packages/server/src/api/routes/commandRoutes.ts](../../packages/server/src/api/routes/commandRoutes.ts) — route registration (Track Operations tag)
- [packages/server/src/fake-data/index.ts](../../packages/server/src/fake-data/index.ts) — scenario registration
- [packages/web/src/commands/commands.ts](../../packages/web/src/commands/commands.ts) — field builder + command list
- [packages/web/src/jobs/commandLabels.ts](../../packages/web/src/jobs/commandLabels.ts) — display label
- CLI command index (grep for sibling command registrations)

### Reuse — do not reinvent

- [fixIncorrectDefaultTracks.ts](../../packages/server/src/app-commands/fixIncorrectDefaultTracks.ts) — pipeline structure; `withFileProgress` + `toArray` + per-file emission contract.
- [runMkvPropEdit.ts](../../packages/server/src/cli-spawn-operations/runMkvPropEdit.ts) — never spawn `mkvpropedit` directly; this wrapper handles tty affordances, tree-kill on unsubscribe, and stderr buffering.
- [getMkvInfo.ts](../../packages/server/src/tools/getMkvInfo.ts) — MKV/track introspection.

## Verification checklist

- [ ] Worktree created at `.claude/worktrees/4f_signs-songs-forced-flag/`
- [ ] Manifest row → `in-progress` in its own `chore(manifest):` commit
- [ ] Failing-test commit precedes green-implementation commit
- [ ] No direct `spawn("mkvpropedit", ...)` — routes through `runMkvPropEdit`
- [ ] One `mkvpropedit` invocation per file even when multiple subtitle tracks match (verify with a multi-track test fixture)
- [ ] Pattern matcher treats `&` / `/` / `and` as equivalent connectors
- [ ] `shouldClearOtherForcedFlags` opt-in path verified in tests
- [ ] One component per file; eslint clean
- [ ] Parity fixture round-trips
- [ ] Fake-data scenario registered and exercised by e2e
- [ ] Standard gate clean (`yarn lint → typecheck → test → e2e → lint`)
- [ ] [docs/workers/MANIFEST.md](MANIFEST.md) row updated to `done`
- [ ] PR opened against `feat/mux-magic-revamp`

## Out of scope

- **Detecting signs/songs from frame content** (OCR, visual analysis). Name-based matching only.
- **Setting other track flags** (`flag-default`, `flag-original`, etc.) — different command, different worker.
- **Modifying track names** to canonicalize "S&S" → "Signs & Songs". Read-only on the name; write-only on the forced flag.
- **Per-language patterns.** If users want different patterns per language, that's a follow-up; this worker ships a single global list.
