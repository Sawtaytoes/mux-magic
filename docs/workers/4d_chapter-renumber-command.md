# Worker 4d — chapter-renumber-command

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/4d-chapter-renumber-command`
**Worktree:** `.claude/worktrees/4d_chapter-renumber-command/`
**Phase:** 5
**Depends on:** 01
**Parallel with:** any Phase 5 worker that doesn't touch [packages/server/src/app-commands/](../../packages/server/src/app-commands/) at the same filenames, [packages/server/src/cli-spawn-operations/](../../packages/server/src/cli-spawn-operations/), or the command schema in [packages/server/src/api/schemas.ts](../../packages/server/src/api/schemas.ts).

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Context

Two real-world patterns produce MKVs whose internal chapter numbering doesn't match the chapter index inside the file:

1. **Split-source files.** An anime BD source ships a single 24-min file with 9 chapters; a release group splits it into three episodes, each carrying a slice of the original chapter list. Episode 2's chapters are numbered `8/9/10` inside the file even though they should be `1/2/3` for that episode standalone.
2. **Multi-disc joins.** Three discs were merged into one collection file. Each disc had chapters `1..30`; the merged file now has the sequence `1..30, 1..30, 1..30` instead of `1..90`. Players list them as duplicates and skip-to-chapter UX breaks.

Renumbering means "rewrite chapter timestamps and names so the index is sequential `1..N`, preserving timecodes and (where present) chapter titles". This is metadata-only — no re-encode, no track touch. The natural tool is `mkvmerge`'s round-trip via `--chapters chapters.xml`: extract chapters as XML, rewrite the numbering, remux with the rewritten XML.

**Why not `mkvpropedit`?** `mkvpropedit --edit chapter:N ...` can rename a chapter but its model is "this one named field" — it cannot restructure chapter UIDs or reorder/renumber atoms wholesale. The renumber operation has to round-trip the chapter XML through `mkvmerge`. This is also why we need a new spawn op — none of the existing ones cover the `--chapters chapters.xml -o output input` shape end-to-end.

## Your Mission

Ship a new `renumberChapters` app-command (server + CLI + web), backed by a new `writeChaptersMkvMerge` cli-spawn-op.

### 1. New cli-spawn-op — `writeChaptersMkvMerge`

New file: `packages/server/src/cli-spawn-operations/writeChaptersMkvMerge.ts`. Mirror the structure of [runMkvMerge.ts](../../packages/server/src/cli-spawn-operations/runMkvMerge.ts) and [runMkvPropEdit.ts](../../packages/server/src/cli-spawn-operations/runMkvPropEdit.ts):

- Signature: `writeChaptersMkvMerge({ inputFilePath, chaptersXmlPath, outputFilePath }): Observable<string>`.
- Spawns `mkvmerge --chapters <chaptersXmlPath> -o <outputFilePath> <inputFilePath>` via the existing `mkvMergePath` resolver in [appPaths.ts](../../packages/server/src/tools/appPaths.ts).
- Reuses the `createTtyAffordances` + `treeKillOnUnsubscribe` + `cli-progress` + `getActiveJobId()` per-file progress emitter pattern that `runMkvMerge` already establishes — copy the wiring, don't invent new logging.
- Errors include the buffered stderr like `runMkvMerge` does (`stderrChunks.join("")`); cancel/close handling is identical.
- On clean exit, emits the `outputFilePath` and completes.

This is a thin wrapper around `mkvmerge`; functionally it's a `runMkvMerge` invocation pinned to the `--chapters` arg shape. Factor whatever's helpful out of `runMkvMerge` rather than duplicating its progress-bar plumbing if a clean extraction presents itself — otherwise inline the copy and leave the shared-helper extraction to a future sweep.

### 2. Chapter-XML rewriter

Pure helper: `packages/server/src/tools/renumberChapterXml.ts`. Takes the chapter XML string `mkvextract chapters input.mkv` produces, returns the rewritten XML string. The rewriter:

- Walks `<ChapterAtom>` elements top-to-bottom and replaces each one's chapter-number annotation with the 1-based sequential index. The MKV chapter XML schema doesn't have a single "chapter number" field — players typically derive the display index from atom order, but chapter **names** like `"Chapter 08"` and `"Chapter 09"` are what the user actually sees and what makes the bug visible. So the rewriter:
  - Detects chapter names that match `/^Chapter\s+\d+$/i` and renumbers them to `Chapter 01`, `Chapter 02`, … (zero-padded to the width of the total count).
  - Leaves non-matching chapter names untouched (preserve "Opening", "Eyecatch", etc.).
  - Optionally regenerates each atom's `<ChapterUID>` to a fresh random UInt64 when the input has duplicates (the multi-disc-join case — `1..30` repeated three times produces colliding UIDs).
- Returns `{ xml, renamedCount, regeneratedUidCount }` so the app-command can emit a structured result the UI/CLI can show.

Use a tolerant XML approach — the existing repo doesn't pull a heavyweight XML lib for one round-trip. A regex pass over `<ChapterAtom>...</ChapterAtom>` blocks is sufficient given the narrow schema mkvmerge emits. Cover edge cases in tests rather than reaching for `xml2js`.

### 3. App-command — `renumberChapters`

New file: `packages/server/src/app-commands/renumberChapters.ts`. Pattern-match [fixIncorrectDefaultTracks.ts](../../packages/server/src/app-commands/fixIncorrectDefaultTracks.ts) for shape — small, file-iterating, uses `withFileProgress` and `getFilesAtDepth`.

Signature:

```ts
renumberChapters({
  isRecursive: boolean,
  isPaddingChapterNumbers: boolean, // defaults true
  regenerateUidsOnCollision: boolean, // defaults true; covers the multi-disc case
  sourcePath: string,
})
```

Per-file pipeline:

1. `mkvextract chapters <file>` via [runMkvExtractStdOut](../../packages/server/src/cli-spawn-operations/runMkvExtractStdOut.ts) — captures the chapter XML as a string.
2. If the file has no chapters (`mkvextract` returns empty/no chapters block), emit `{ filePath, action: "skipped", reason: "no-chapters" }` and continue.
3. Run the chapter XML through `renumberChapterXml`.
4. If `renamedCount === 0 && regeneratedUidCount === 0`, emit `{ action: "already-sequential" }` and skip the write — no point spawning mkvmerge to produce a byte-identical output.
5. Write the rewritten XML to a temp file (`<file>.chapters.<rand>.xml` under the OS temp dir; clean up on completion/error).
6. Invoke `writeChaptersMkvMerge` with the temp XML, writing to `<file>.renumbered.mkv`.
7. Atomically replace the original via `fs.rename` (cross-device fallback: copy + unlink, same shape `aclSafeCopyFile` already handles elsewhere).
8. Emit `{ filePath, action: "renumbered", renamedCount, regeneratedUidCount }`.

Use [filterIsVideoFile](../../packages/server/src/tools/filterIsVideoFile.js) before processing so non-video files in the directory don't blow up `mkvextract`.

### 4. CLI command

New file: `packages/cli/src/cli-commands/renumberChaptersCommand.ts`. Pattern-match [fixIncorrectDefaultTracksCommand.ts](../../packages/cli/src/cli-commands/fixIncorrectDefaultTracksCommand.ts). Yargs flags:

- `--source-path <path>` (required, "Source Path" — note worker 24 has codified the naming).
- `--recursive` / `--no-recursive` (default `false`).
- `--pad-chapter-numbers` / `--no-pad-chapter-numbers` (default `true`).
- `--regenerate-uids-on-collision` / `--no-regenerate-uids-on-collision` (default `true`).

### 5. Web command surface

Register the command in [packages/server/src/api/schemas.ts](../../packages/server/src/api/schemas.ts) under the command-names enum and add its zod params schema. The web side picks it up from the schema automatically once registered (the command-picker is schema-driven). Add a parity fixture at:

- `packages/web/tests/fixtures/parity/renumberChapters.input.json`
- `packages/web/tests/fixtures/parity/renumberChapters.yaml`

Mirror an existing fixture pair (e.g. `fixIncorrectDefaultTracks.input.json` / `.yaml`) for shape.

Add a one-paragraph description to [packages/web/public/command-descriptions.js](../../packages/web/public/command-descriptions.js) so the command-picker tooltip explains "renumbers MKV chapters sequentially via a metadata-only mkvmerge remux; safe to run repeatedly; skips files whose chapter list is already sequential".

## Tests (per test-coverage discipline)

- **`renumberChapterXml` (pure):**
  - Input: 3 atoms named `Chapter 08`, `Chapter 09`, `Chapter 10` → output names `Chapter 01`, `Chapter 02`, `Chapter 03`; `renamedCount === 3`.
  - Input: mixed names (`Chapter 01`, `Opening`, `Chapter 03`) → only the `Chapter NN` ones get renumbered; `Opening` is preserved verbatim.
  - Input: `ChapterUID` duplicates → with `regenerateUidsOnCollision: true`, each duplicate gets a unique fresh UInt64; with `false`, UIDs are left alone.
  - Input: already-sequential `Chapter 01..03` → `renamedCount === 0` (idempotent: round-trip-safe; the command should detect this and skip the remux).
  - Zero-padding width: 12 atoms → `Chapter 01..12`; 100 atoms → `Chapter 001..100`.
- **`writeChaptersMkvMerge` (spawn-op):** mock `child_process.spawn` (use the same approach the repo's other spawn-op tests use; check `runMkvMerge.test.ts` if present) and assert the args list contains `--chapters <xml>`, `-o <output>`, `<input>` in that order. Verify stderr buffering + non-zero-exit error message shape mirrors `runMkvMerge`.
- **`renumberChapters` app-command (integration with the spawn-op mocked):**
  - File with `Chapter 08/09/10` → emits one `renumbered` result, calls `writeChaptersMkvMerge` exactly once.
  - File with already-sequential chapters → emits `already-sequential`, **does not** call `writeChaptersMkvMerge`.
  - File with no chapters → emits `skipped` with `reason: "no-chapters"`.
  - Cross-device rename failure → falls back to copy+unlink without losing the file.
- **Schema validation:** the new command name is accepted by `sequenceRoutes`'s command-name enum; invalid `sourcePath` (empty string) is rejected.

## TDD steps

1. **Red — XML rewriter tests.** Commit `test(server): failing tests for renumberChapterXml`.
2. **Green — implement `renumberChapterXml`.**
3. **Red — spawn-op test.** Commit `test(server): failing tests for writeChaptersMkvMerge`.
4. **Green — implement `writeChaptersMkvMerge`** by cloning `runMkvMerge`'s plumbing.
5. **Red — app-command integration.** Commit `test(server): failing tests for renumberChapters command`.
6. **Green — implement `renumberChapters`** + schema registration + CLI command.
7. **Parity fixtures + web description.** Commit `feat(web): expose renumberChapters in command picker`.
8. **Manifest flips** as dedicated `chore(manifest):` commits.

## Files

### New

- `packages/server/src/tools/renumberChapterXml.ts` + `.test.ts`
- `packages/server/src/cli-spawn-operations/writeChaptersMkvMerge.ts` + `.test.ts`
- `packages/server/src/app-commands/renumberChapters.ts` + `.test.ts`
- `packages/cli/src/cli-commands/renumberChaptersCommand.ts`
- `packages/web/tests/fixtures/parity/renumberChapters.input.json`
- `packages/web/tests/fixtures/parity/renumberChapters.yaml`

### Extend

- [packages/server/src/api/schemas.ts](../../packages/server/src/api/schemas.ts) — register the command name + params schema.
- [packages/web/public/command-descriptions.js](../../packages/web/public/command-descriptions.js) — add the user-facing description.

### Reuse — do not reinvent

- [runMkvMerge.ts](../../packages/server/src/cli-spawn-operations/runMkvMerge.ts) — progress-emitter wiring, tty affordances, tree-kill teardown. The new spawn-op mirrors this shape.
- [runMkvExtractStdOut.ts](../../packages/server/src/cli-spawn-operations/runMkvExtractStdOut.ts) — already returns process stdout; perfect for capturing the chapter XML.
- [fixIncorrectDefaultTracks.ts](../../packages/server/src/app-commands/fixIncorrectDefaultTracks.ts) — the directory-walk + per-file-result-emit shape this command should follow.
- [filterIsVideoFile.ts](../../packages/server/src/tools/filterIsVideoFile.ts) — the same video-extension filter every video-touching command applies.

## Out of scope

- Editing chapter **timestamps** (start/end times). Renumbering is index-only; the round-trip preserves timecodes.
- Trimming trailing credit chapters — that's worker `4e` (`detect-trailing-credit-chapters`).
- Splitting an already-merged multi-disc file back into per-disc chunks — that's a separate split-by-chapter command and is not in scope here.
- Renaming non-`Chapter NN` chapter names (e.g. localising "Opening" / "Ending"). The rewriter is conservative on purpose.
- A bulk "renumber + trim credits + rename" macro — compose `4d` + `4e` (when it lands) at the sequence level.

## Verification checklist

- [ ] Worktree created; manifest row → `in-progress` in its own `chore(manifest):` commit
- [ ] All TDD steps land as red-then-green commit pairs
- [ ] The new command appears in the web command picker with the description text
- [ ] Manual smoke: run the command against a `Chapter 08/09/10` test MKV; verify chapters list as `Chapter 01/02/03` in MKVToolNix GUI afterwards and that the file's size is within a few KB of the original (no re-encode)
- [ ] Manual smoke: run against a file with already-sequential chapters; verify `already-sequential` result and that `mkvmerge` was **not** invoked (check job log)
- [ ] Standard gate clean (`lint → typecheck → test → e2e → lint`)
- [ ] PR opened against `feat/mux-magic-revamp`
- [ ] [docs/workers/MANIFEST.md](MANIFEST.md) row updated to `done`
