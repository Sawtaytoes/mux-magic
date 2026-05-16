# Worker 4c — subtitle-attachments-and-track-granular-merge

**Model:** Opus · **Thinking:** ON · **Effort:** High
**Branch:** `feat/mux-magic-revamp/4c-subtitle-attachments-and-track-granular-merge`
**Worktree:** `.claude/worktrees/4c_subtitle-attachments-and-track-granular-merge/`
**Phase:** 5
**Depends on:** 3b (subtitle/track command consolidation — the merge-mode discriminator builds on its schema topology)
**Parallel with:** any Phase 5 worker that doesn't touch [packages/server/src/app-commands/extractSubtitles.ts](../../packages/server/src/app-commands/extractSubtitles.ts), [packages/server/src/app-commands/mergeTracks.ts](../../packages/server/src/app-commands/mergeTracks.ts), [packages/server/src/cli-spawn-operations/mergeSubtitlesMkvMerge.ts](../../packages/server/src/cli-spawn-operations/mergeSubtitlesMkvMerge.ts), [packages/server/src/api/schemas.ts](../../packages/server/src/api/schemas.ts), or the matching web field schemas.

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Context

Two real workflows the current command shape can't express cleanly. They're separate UX surfaces but share enough mkvmerge-arg plumbing that splitting them across two workers would force the same plumbing twice.

**Problem A — attachments aren't extracted with subtitles.** Today [packages/server/src/app-commands/extractSubtitles.ts](../../packages/server/src/app-commands/extractSubtitles.ts) pulls subtitle tracks via `mkvextract tracks`. The user then opens the extracted `.ass`/`.srt` in Aegisub to edit. Aegisub references the file's *attachments* — TTF/OTF fonts, occasionally raster overlays — which never made it onto disk. The user has to manually run `mkvextract attachments` against the source file before editing, every time. This is mechanical busywork the existing command should optionally do in one shot.

**Problem B — merging back clobbers everything else.** When the user finishes editing one subtitle track and wants to merge it back into the source MKV via [mergeTracks.ts](../../packages/server/src/app-commands/mergeTracks.ts) (which spawns through [mergeSubtitlesMkvMerge.ts](../../packages/server/src/cli-spawn-operations/mergeSubtitlesMkvMerge.ts)), the current code path replaces **all** subtitle tracks. If the file had English + Japanese + signs/songs subs and the user only edited the English track, the Japanese and signs/songs tracks vanish from the output. Same for attachments — the existing `replace-all` semantics drop anything the user didn't explicitly carry over.

The selective pattern needed already exists in the codebase: [packages/server/src/cli-spawn-operations/replaceAttachmentsMkvMerge.ts](../../packages/server/src/cli-spawn-operations/replaceAttachmentsMkvMerge.ts) shows how to use mkvmerge's track-selection flags to swap one slot of a container without touching the others. This worker extends that selective approach to subtitle tracks via mkvmerge's track-UID model.

## Your Mission

### 1. `extractSubtitles` — optional `extractAttachments` flag

Extend [packages/server/src/app-commands/extractSubtitles.ts](../../packages/server/src/app-commands/extractSubtitles.ts) with one new optional input:

| Field | Type | Default | Notes |
|---|---|---|---|
| `extractAttachments` | boolean | `false` | When `true`, after extracting subtitle tracks the command also runs `mkvextract attachments` against the source file and writes the attachments into a sibling folder. |

Default is `false` to preserve current behavior for users who never edit subs in Aegisub.

Output layout — attachments land in `<outputFolderName>/attachments/` next to the extracted subtitle files, so one folder per source MKV contains everything Aegisub needs. Do not invent a new top-level path knob; reuse `outputFolderName`.

Implementation:

- New `cli-spawn-op` only if `mkvextract attachments` isn't already wrapped — check for an existing `extractAttachmentsMkvExtract.ts` (similar to `extractSubtitleTrack.ts`) before creating a new file. If none exists, add `packages/server/src/cli-spawn-operations/extractAttachmentsMkvExtract.ts` following the structural pattern of [extractSubtitleTrack.ts](../../packages/server/src/cli-spawn-operations/extractSubtitleTrack.ts).
- Pipeline: existing subtitle extraction runs unchanged; when `extractAttachments === true`, append a `concatMap` that runs `mkvextract attachments <source> <id>:<dest>` for each attachment listed in `getMkvInfo` output.
- Skip silently when the source has zero attachments; emit a single `logInfo` line for non-zero cases listing the attachment names written.

### 2. `mergeTracks` / `mergeSubtitlesMkvMerge` — `mode` discriminator

Add a new top-level field to both [packages/server/src/app-commands/mergeTracks.ts](../../packages/server/src/app-commands/mergeTracks.ts) and the spawn op [packages/server/src/cli-spawn-operations/mergeSubtitlesMkvMerge.ts](../../packages/server/src/cli-spawn-operations/mergeSubtitlesMkvMerge.ts):

```ts
type MergeMode =
  | { mode: "replace-all" }                            // existing behavior; default
  | { mode: "replace-by-track-uid"; targetTrackUid: number }
```

Discriminator semantics:

- **`replace-all`** — current behavior, byte-for-byte. Default. No migration risk for existing saved sequences.
- **`replace-by-track-uid`** — produce mkvmerge args that copy every track and attachment from the source EXCEPT the one with `targetTrackUid`, then merge the new subtitle in its place. The track UID is the stable identifier mkvmerge exposes via `mkvmerge -i -J` (already surfaced by the project's `getMkvInfo` wrapper at [packages/server/src/tools/getMkvInfo.ts](../../packages/server/src/tools/getMkvInfo.ts)). Use that — never the positional track index, which renumbers when tracks are added/removed.

mkvmerge invocation for `replace-by-track-uid`:

- `--subtitle-tracks !<uid>` excludes the one target track on the source side.
- All other tracks (`--audio-tracks`, `--video-tracks`, etc.) and `--attachments` pass through untouched.
- The replacement subtitle file is appended as a second input. Reuse the language/default-flag plumbing that already exists in `mergeSubtitlesMkvMerge`.

Mirror the [replaceAttachmentsMkvMerge.ts](../../packages/server/src/cli-spawn-operations/replaceAttachmentsMkvMerge.ts) selective-replacement pattern — same `runMkvMerge.js` underlying call, same `outputFolderName` knob, same Observable shape.

### 3. Schema (server + web) updates

- [packages/server/src/api/schemas.ts](../../packages/server/src/api/schemas.ts) — add `extractAttachments: z.boolean().optional()` to `extractSubtitlesRequestSchema`; add the `MergeMode` discriminator (`z.discriminatedUnion("mode", [...])`) to `mergeTracksRequestSchema`. Keep `replace-all` as the inferred default when the field is absent so existing saved YAML still validates without migration.
- [packages/web/src/commands/commands.ts](../../packages/web/src/commands/commands.ts) — update the `extractSubtitles` and `mergeTracks` field metadata so the new fields surface in the builder UI. The `mode` field should render as a dropdown (existing discriminator-rendering convention — do not invent a new control). `targetTrackUid` is a number field shown only when `mode === "replace-by-track-uid"`.
- [packages/web/src/jobs/yamlCodec.ts](../../packages/web/src/jobs/yamlCodec.ts) — confirm the new fields round-trip; the discriminator should serialize as `mode: replace-by-track-uid` plus `targetTrackUid: 3` rather than a nested object. Use the standard `legacyFieldRenames` convention for any back-compat needs (memory ref: yamlCodec is the canonical location and legacy-rename hook).
- Parity fixtures: update [packages/web/tests/fixtures/parity/extractSubtitles.input.json](../../packages/web/tests/fixtures/parity/extractSubtitles.input.json) + `.yaml`, and [packages/web/tests/fixtures/parity/mergeTracks.input.json](../../packages/web/tests/fixtures/parity/mergeTracks.input.json) + `.yaml`, so the new fields are exercised by the parity test harness. Use [packages/web/scripts/capture-parity-fixtures.ts](../../packages/web/scripts/capture-parity-fixtures.ts) to regenerate.

### 4. CLI surface

[packages/cli/src/cli-commands/extractSubtitlesCommand.ts](../../packages/cli/src/cli-commands/extractSubtitlesCommand.ts) and [packages/cli/src/cli-commands/mergeTracksCommand.ts](../../packages/cli/src/cli-commands/mergeTracksCommand.ts) — extend the yargs option definitions to expose the new flags. `--extract-attachments` is a boolean. For mode: `--mode replace-all|replace-by-track-uid` plus `--target-track-uid <n>` (the schema must enforce that `targetTrackUid` is present iff `mode === "replace-by-track-uid"`).

### 5. Web — field schema rendering

The discriminator UI lives wherever the existing `mergeTracks` form is rendered (check [packages/web/src/commands/commands.ts](../../packages/web/src/commands/commands.ts) and any sibling `MergeTracksFields*` components that might exist via grep). Reuse whatever discriminator-renderer the codebase already has for `mode`-style unions — do not invent a new pattern for this one command. If no shared discriminator field component exists, extract one as a sibling component (`react/no-multi-comp` is now enforced — every component goes in its own file).

## Tests / TDD

Two-commit pattern: failing red commit first, then green implementation.

1. **`extractAttachments: false` is no-op** — existing extract path runs unchanged; `extractAttachmentsMkvExtract` (or whichever wrapper) is never invoked.
2. **`extractAttachments: true` with zero attachments** — silently skips the attachment phase; produces no error; emits no spurious log line.
3. **`extractAttachments: true` with three attachments** — mock `getMkvInfo` returns three attachments; assert `mkvextract attachments` is called once with the three `id:dest` pairs, each writing into `<outputFolderName>/attachments/<filename>`.
4. **`mode: "replace-all"` (default)** — when omitted from YAML, schema parses to the same effective args as today; existing parity fixture continues to pass.
5. **`mode: "replace-by-track-uid"` arg generation** — given a source file with three subtitle tracks UIDs `[111, 222, 333]`, `targetTrackUid: 222`, assert the generated mkvmerge invocation contains `--subtitle-tracks !222` (or equivalent excluding-only-222 form), preserves the other two tracks, preserves attachments (no `--no-attachments`), and appends the replacement subtitle input.
6. **Schema rejects mismatched discriminator** — `mode: "replace-all"` with `targetTrackUid: 5` rejects; `mode: "replace-by-track-uid"` without `targetTrackUid` rejects.
7. **YAML round-trip** — both new fields round-trip through `yamlCodec`; serialized form is flat (`mode: replace-by-track-uid` at the same level as other fields, not nested under `mergeMode:`).
8. **Parity fixtures** — `extractSubtitles` and `mergeTracks` parity tests still pass after the schema additions; new fixtures exercising the new fields are captured and verified.
9. **E2E (Playwright)** — drive the builder UI to construct an `extractSubtitles` step with `extractAttachments: true`, save, reload, verify the field round-trips through the URL/YAML pathways.

## Files

### New

- [packages/server/src/cli-spawn-operations/extractAttachmentsMkvExtract.ts](../../packages/server/src/cli-spawn-operations/extractAttachmentsMkvExtract.ts) (only if no equivalent already exists — grep first)
- [packages/server/src/cli-spawn-operations/extractAttachmentsMkvExtract.test.ts](../../packages/server/src/cli-spawn-operations/extractAttachmentsMkvExtract.test.ts)
- New parity fixtures listed under §3 above

### Modified

**Server:**
- [packages/server/src/app-commands/extractSubtitles.ts](../../packages/server/src/app-commands/extractSubtitles.ts)
- [packages/server/src/app-commands/extractSubtitles.test.ts](../../packages/server/src/app-commands/extractSubtitles.test.ts)
- [packages/server/src/app-commands/mergeTracks.ts](../../packages/server/src/app-commands/mergeTracks.ts)
- [packages/server/src/app-commands/mergeTracks.test.ts](../../packages/server/src/app-commands/mergeTracks.test.ts) (if exists; else add)
- [packages/server/src/cli-spawn-operations/mergeSubtitlesMkvMerge.ts](../../packages/server/src/cli-spawn-operations/mergeSubtitlesMkvMerge.ts)
- [packages/server/src/cli-spawn-operations/mergeSubtitlesMkvMerge.test.ts](../../packages/server/src/cli-spawn-operations/mergeSubtitlesMkvMerge.test.ts) (if exists; else add)
- [packages/server/src/api/schemas.ts](../../packages/server/src/api/schemas.ts) — extend both request schemas

**CLI:**
- [packages/cli/src/cli-commands/extractSubtitlesCommand.ts](../../packages/cli/src/cli-commands/extractSubtitlesCommand.ts)
- [packages/cli/src/cli-commands/mergeTracksCommand.ts](../../packages/cli/src/cli-commands/mergeTracksCommand.ts)

**Web:**
- [packages/web/src/commands/commands.ts](../../packages/web/src/commands/commands.ts) — field metadata for both commands
- [packages/web/src/jobs/yamlCodec.ts](../../packages/web/src/jobs/yamlCodec.ts) — verify discriminator round-trip; add `legacyFieldRenames` entry only if a field has to be renamed for clarity
- [packages/web/src/jobs/yamlCodec.test.ts](../../packages/web/src/jobs/yamlCodec.test.ts) — round-trip case for both new fields
- [packages/web/tests/fixtures/parity/extractSubtitles.input.json](../../packages/web/tests/fixtures/parity/extractSubtitles.input.json) + `.yaml`
- [packages/web/tests/fixtures/parity/mergeTracks.input.json](../../packages/web/tests/fixtures/parity/mergeTracks.input.json) + `.yaml`

### Reuse — do not reinvent

- `mkvmerge`/`mkvextract` wrappers in [packages/server/src/cli-spawn-operations/](../../packages/server/src/cli-spawn-operations/) — extend existing helpers; do not spawn `mkvmerge` directly from app-commands.
- `getMkvInfo` for track UIDs and attachment listings — it already parses `mkvmerge -J` output.
- The selective-replacement pattern in [replaceAttachmentsMkvMerge.ts](../../packages/server/src/cli-spawn-operations/replaceAttachmentsMkvMerge.ts) — this is the structural template for `replace-by-track-uid`.
- The existing builder discriminator-field renderer (whichever component handles discriminators today) — find it and reuse it. Do not invent a parallel mode-selector control.

## Verification

- [ ] Standard gates clean: `yarn lint → yarn typecheck → yarn test → yarn test:e2e → yarn lint`
- [ ] All TDD tests pass (red commit visible in `git log` before green)
- [ ] Existing saved sequences without the new fields still load and run identically — `replace-all` is the inferred default when `mode` is absent
- [ ] Manual smoke: extract subs + attachments from one MKV that has fonts; edit one `.ass` in any text editor; merge it back via `replace-by-track-uid`; verify mkvmerge -J on the output still shows the other subtitle tracks and the attachments intact
- [ ] Parity fixtures regenerated and committed
- [ ] `chore(manifest):` commit flips [docs/workers/MANIFEST.md](MANIFEST.md) row 4c to `done` after merge (separate commit — never bundled with code)
- [ ] PR opened against `feat/mux-magic-revamp`

## Out of scope

- **Replacing attachments selectively in `mergeTracks`.** That stays the job of `replaceAttachmentsMkvMerge`; this worker only extends the subtitle-track selective path.
- **A general `replace-by-track-name` mode.** Track names aren't unique. UIDs are the stable identifier; if a future workflow needs name-matching it can resolve name → UID at the call site.
- **Multi-track replacement in one call** (`replace-by-track-uids: number[]`). Possible extension; the current discriminator shape leaves room for `mode: "replace-by-track-uids"` later without breaking `replace-by-track-uid`. Not built in this PR.
- **A new top-level "edit subtitles in Aegisub" workflow command.** Composing `extractSubtitles` (with `extractAttachments: true`) → user edits → `mergeTracks` (with `mode: replace-by-track-uid`) is the workflow. No wrapper command.
