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

This command exists because two real-world patterns produce MKVs whose chapter names don't match the chapter index inside the file. The command handles **three** input shapes; it acts on two of them and deliberately leaves the third alone.

### Scenario 1 — split-source files (chapters don't start at 1)

An anime BD source ships a single 24-min file with 9 chapters; a release group splits it into three episodes, each carrying a slice of the original chapter list. Episode 2's chapters are numbered `Chapter 04`/`Chapter 05`/`Chapter 06` inside the file even though they should be `Chapter 01`/`Chapter 02`/`Chapter 03` for that episode standalone.

```text
Before:  Chapter 04   Chapter 05   Chapter 06
After:   Chapter 01   Chapter 02   Chapter 03
```

Status: `renumbered`. Timecodes untouched.

### Scenario 2 — combined-source files (chapters reset partway through)

Multiple discs or episodes were merged into one file. Each source contributed its own `Chapter 01..N` sequence, so the merged file has restarting runs (e.g. `1,2,3, 1,2,3` instead of `1..6`). Players list duplicate chapter names and skip-to-chapter UX breaks.

```text
Before:  Chapter 01   Chapter 02   Chapter 03   Chapter 01   Chapter 02   Chapter 03
After:   Chapter 01   Chapter 02   Chapter 03   Chapter 04   Chapter 05   Chapter 06
```

Status: `renumbered`. Timecodes untouched. The first three names happened to already be correct; only the trailing three changed, but the file is still rewritten as a single round-trip.

### Scenario 3 — mixed named/numbered chapters (skip, do nothing)

A file whose chapters mix `Chapter NN` names with custom names like `Opening`, `Eyecatch`, `Part A`:

```text
Input:   Chapter 05   Opening   Chapter 07   Eyecatch   Chapter 09
Output:  (file is not modified)
```

Status: `skipped`, `reason: "mixed-chapter-names"`.

**Why we skip rather than guess:** without an example of the source's intended numbering, we can't accurately tell what the user wants. Should `Opening` count as a chapter for numbering purposes? Should it be `Chapter 01, Opening, Chapter 02, Eyecatch, Chapter 03` (renumber matches among themselves) or `Chapter 01, Opening, Chapter 02, Eyecatch, Chapter 03` (renumber by position, ignoring custom names) or something else entirely? The two strategies happen to coincide in that example but diverge as soon as a custom name lands between non-adjacent numbered chapters. There's no signal inside the file that tells us which intent applies — different release groups use different conventions, and the same file might have been hand-edited. Doing nothing is the only safe answer; the user can rename chapters manually in MKVToolNix GUI if they want.

### How the command implements this

Renumbering is **name-only**. Timecodes are preserved verbatim, `<ChapterUID>` values are preserved verbatim — this command never touches start/end times, UIDs, languages, or flags. It's metadata-only — no re-encode, no track touch. The natural tool is `mkvmerge`'s round-trip via `--chapters chapters.xml`: extract chapters as XML, rewrite the numeric portion of `Chapter NN` names in atom order, remux with the rewritten XML. Scenarios 1 and 2 use this path; scenario 3 never reaches it.

**Why not `mkvpropedit`?** `mkvpropedit --edit chapter:N --set ChapString=...` could rename a single chapter, but the renumber operation needs to rewrite N chapter names atomically and consistently across the file. One XML rewrite + one remux is simpler to reason about than N pinpoint edits whose ordering depends on atom indexing. This is also why we need a new spawn op — none of the existing ones cover the `--chapters chapters.xml -o output input` shape end-to-end.

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

- Walks `<ChapterAtom>` elements top-to-bottom. The MKV chapter XML schema doesn't have a single "chapter number" field — players derive the display index from atom order, but chapter **names** like `"Chapter 08"` and `"Chapter 09"` are what the user actually sees and what makes the bug visible. So the rewriter:
  - First inspects every atom's chapter name. If **every** atom matches `/^Chapter\s+\d+$/i`, the rewriter renumbers them to `Chapter 01`, `Chapter 02`, … (zero-padded to the width of the total atom count) in atom order.
  - If **any** atom has a name that doesn't match the pattern, the rewriter bails out early and signals "mixed" — the caller treats the file as not-ours and skips it. This is the simple all-or-nothing rule: we only renumber files whose chapters are uniformly `Chapter NN`.
  - Never edits `<ChapterTimeStart>` / `<ChapterTimeEnd>` / `<ChapterUID>` / language / flags. Renaming is the entire mutation surface.
- Returns `{ xml, renamedCount, status }` where `status` is one of `"renumbered"` (all atoms matched and at least one was renamed), `"already-sequential"` (all atoms matched and the numbers were already `01..N`), or `"mixed"` (at least one atom didn't match — caller skips the file). `renamedCount` is meaningful only when `status === "renumbered"`.

Use a tolerant XML approach — the existing repo doesn't pull a heavyweight XML lib for one round-trip. A regex pass over `<ChapterAtom>...</ChapterAtom>` blocks is sufficient given the narrow schema mkvmerge emits. Cover edge cases in tests rather than reaching for `xml2js`.

### 3. App-command — `renumberChapters`

New file: `packages/server/src/app-commands/renumberChapters.ts`. Pattern-match [fixIncorrectDefaultTracks.ts](../../packages/server/src/app-commands/fixIncorrectDefaultTracks.ts) for shape — small, file-iterating, uses `withFileProgress` and `getFilesAtDepth`.

Signature:

```ts
renumberChapters({
  isRecursive: boolean,
  isPaddingChapterNumbers: boolean, // defaults true
  sourcePath: string,
})
```

Per-file pipeline:

1. `mkvextract chapters <file>` via [runMkvExtractStdOut](../../packages/server/src/cli-spawn-operations/runMkvExtractStdOut.ts) — captures the chapter XML as a string.
2. If the file has no chapters (`mkvextract` returns empty/no chapters block), emit `{ filePath, action: "skipped", reason: "no-chapters" }` and continue.
3. Run the chapter XML through `renumberChapterXml`.
4. If `status === "mixed"`, emit `{ action: "skipped", reason: "mixed-chapter-names" }` and continue — the file has at least one chapter name that isn't `Chapter NN`, so this command leaves it alone entirely.
5. If `status === "already-sequential"`, emit `{ action: "already-sequential" }` and skip the write — no point spawning mkvmerge to produce a byte-identical output.
6. Write the rewritten XML to a temp file (`<file>.chapters.<rand>.xml` under the OS temp dir; clean up on completion/error).
7. Invoke `writeChaptersMkvMerge` with the temp XML, writing to `<file>.renumbered.mkv`.
8. Atomically replace the original via `fs.rename` (cross-device fallback: copy + unlink, same shape `aclSafeCopyFile` already handles elsewhere).
9. Emit `{ filePath, action: "renumbered", renamedCount }`.

Use [filterIsVideoFile](../../packages/server/src/tools/filterIsVideoFile.js) before processing so non-video files in the directory don't blow up `mkvextract`.

### 4. CLI command

New file: `packages/cli/src/cli-commands/renumberChaptersCommand.ts`. Pattern-match [fixIncorrectDefaultTracksCommand.ts](../../packages/cli/src/cli-commands/fixIncorrectDefaultTracksCommand.ts). Yargs flags:

- `--source-path <path>` (required, "Source Path" — note worker 24 has codified the naming).
- `--recursive` / `--no-recursive` (default `false`).
- `--pad-chapter-numbers` / `--no-pad-chapter-numbers` (default `true`).

### 5. Web command surface

Register the command in [packages/server/src/api/schemas.ts](../../packages/server/src/api/schemas.ts) under the command-names enum and add its zod params schema. The web side picks it up from the schema automatically once registered (the command-picker is schema-driven). Add a parity fixture at:

- `packages/web/tests/fixtures/parity/renumberChapters.input.json`
- `packages/web/tests/fixtures/parity/renumberChapters.yaml`

Mirror an existing fixture pair (e.g. `fixIncorrectDefaultTracks.input.json` / `.yaml`) for shape.

Add a one-paragraph description to [packages/web/public/command-descriptions.js](../../packages/web/public/command-descriptions.js) so the command-picker tooltip explains "renames `Chapter NN`-style chapter names so the numbers are sequential `1..N` via a metadata-only mkvmerge remux; preserves timecodes and non-numbered names (`Opening`, `Eyecatch`, etc.); skips files with no numbered chapters and files already sequential; safe to run repeatedly".

## Tests (per test-coverage discipline)

- **`renumberChapterXml` (pure):**
  - **Split-source case:** 3 atoms named `Chapter 08`, `Chapter 09`, `Chapter 10` → output names `Chapter 01`, `Chapter 02`, `Chapter 03`; `status === "renumbered"`, `renamedCount === 3`.
  - **Combined-source case:** 6 atoms named `Chapter 01, Chapter 02, Chapter 03, Chapter 01, Chapter 02, Chapter 03` → output `Chapter 01..06`; `status === "renumbered"`, `renamedCount === 3` (the first three atoms didn't need a name change).
  - **Mixed case:** any atom with a non-`Chapter NN` name (e.g. `Chapter 01`, `Opening`, `Chapter 03`) → `status === "mixed"`, XML returned unchanged. The app-command treats this as a skip.
  - **All-custom case:** every atom is a custom name (e.g. all `Opening`/`Ending`/`Part A`) → `status === "mixed"`, XML unchanged.
  - **Already-sequential case:** atoms named `Chapter 01..03` → `status === "already-sequential"`, `renamedCount === 0` (idempotent: round-trip-safe; the command skips the remux).
  - Timecodes are never modified: snapshot test that `<ChapterTimeStart>` / `<ChapterTimeEnd>` substrings come through byte-identical when `status === "renumbered"`.
  - `<ChapterUID>` values are never modified — even when the input has duplicates (multi-disc-join case). Snapshot/equality test asserts UIDs round-trip verbatim.
  - Zero-padding width: 12 atoms → `Chapter 01..12`; 100 atoms → `Chapter 001..100`.
- **`writeChaptersMkvMerge` (spawn-op):** mock `child_process.spawn` (use the same approach the repo's other spawn-op tests use; check `runMkvMerge.test.ts` if present) and assert the args list contains `--chapters <xml>`, `-o <output>`, `<input>` in that order. Verify stderr buffering + non-zero-exit error message shape mirrors `runMkvMerge`.
- **`renumberChapters` app-command (integration with the spawn-op mocked):**
  - File with `Chapter 08/09/10` → emits one `renumbered` result, calls `writeChaptersMkvMerge` exactly once.
  - File with already-sequential chapters → emits `already-sequential`, **does not** call `writeChaptersMkvMerge`.
  - File with no chapters → emits `skipped` with `reason: "no-chapters"`.
  - File whose chapters are all custom names (no `Chapter NN` matches) → emits `skipped` with `reason: "no-numbered-chapters"`, **does not** call `writeChaptersMkvMerge`.
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

- Editing chapter **timestamps** (start/end times). Renumbering is name-only; the round-trip preserves timecodes verbatim.
- Editing `<ChapterUID>` values. Even when a multi-disc-join produces duplicate UIDs, this command leaves them alone — UID dedup is a separate concern and is not in scope here.
- Renaming non-`Chapter NN` chapter names (e.g. localising `Opening`/`Ending`, normalising `Part A`/`Part B`). The rewriter is conservative on purpose.
- Files whose chapters are **entirely** custom names with no `Chapter NN` matches: the command skips them rather than imposing a `Chapter 01..N` naming scheme on a file that deliberately used custom names.
- Trimming trailing credit chapters — that's worker `4e` (`detect-trailing-credit-chapters`).
- Splitting an already-merged multi-disc file back into per-disc chunks — that's a separate split-by-chapter command and is not in scope here.
- A bulk "renumber + trim credits + rename" macro — compose `4d` + `4e` (when it lands) at the sequence level.

## Verification checklist

- [ ] Worktree created; manifest row → `in-progress` in its own `chore(manifest):` commit
- [ ] All TDD steps land as red-then-green commit pairs
- [ ] The new command appears in the web command picker with the description text
- [ ] Manual smoke: run the command against a `Chapter 08/09/10` test MKV; verify chapters list as `Chapter 01/02/03` in MKVToolNix GUI afterwards and that the file's size is within a few KB of the original (no re-encode)
- [ ] Manual smoke: run against a file with already-sequential chapters; verify `already-sequential` result and that `mkvmerge` was **not** invoked (check job log)
- [ ] Manual smoke: run against a file whose chapters are all custom names (e.g. `Opening`/`Part A`/`Ending`); verify `skipped` with `reason: "no-numbered-chapters"` and that `mkvmerge` was **not** invoked
- [ ] Standard gate clean (`lint → typecheck → test → e2e → lint`)
- [ ] PR opened against `feat/mux-magic-revamp`
- [ ] [docs/workers/MANIFEST.md](MANIFEST.md) row updated to `done`
