# Worker 52 — dvdcompare-cuts-censorship-detection

**Model:** Sonnet · **Thinking:** ON · **Effort:** High
**Branch:** `feat/mux-magic-revamp/52-dvdcompare-cuts-censorship-detection`
**Worktree:** `.claude/worktrees/52_dvdcompare-cuts-censorship-detection/`
**Phase:** 5
**Depends on:** 22 (NSF rename — `searchDvdCompare` baseline + canonical command-name conventions), 3a (NSF module split — the `parseSpecialFeatures` HTML-parse pattern this worker mirrors lives in the same family of `*.ts` tools post-3a)
**Parallel with:** any Phase 5 worker that doesn't touch [packages/server/src/tools/searchDvdCompare.ts](../../packages/server/src/tools/searchDvdCompare.ts), [packages/server/src/tools/parseSpecialFeatures.ts](../../packages/server/src/tools/parseSpecialFeatures.ts), [packages/server/src/tools/__fixtures__/](../../packages/server/src/tools/__fixtures__/), or [packages/server/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.ts](../../packages/server/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.ts) family.

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Context

DVDCompare.net publishes a "cuts" table on most release pages: a list of censored, removed, or edition-specific scenes with timecode-aligned descriptions and aggregate seconds-removed totals. For releases the user already identifies via the existing DVD Compare integration (the NSF flow has been wiring this up since worker 22), this table is the single best ground-truth signal for "is the local file the uncut version or a censored regional cut?"

Today the codebase parses one DVDCompare surface — the special-features list — via [packages/server/src/tools/parseSpecialFeatures.ts](../../packages/server/src/tools/parseSpecialFeatures.ts). That parser establishes the pattern: load a known fixture HTML, walk the DOM into a structured object, snapshot-test the result so brittle scraper changes surface immediately. The cuts table needs the same treatment.

Once the cuts data is parsed, comparing it against the local file's actual duration is a small, well-defined heuristic:

- `expectedRuntime` = the release's listed runtime on the DVDCompare page.
- `cutsRemovedSeconds` = sum of the cuts table's per-cut deltas.
- Local file duration via `mkvmerge -J` (already wrapped by [packages/server/src/tools/getFileDuration.ts](../../packages/server/src/tools/getFileDuration.ts)).
- Tolerance band: ±2 seconds (configurable). Anything outside the band is flagged.

Three outcomes per file:
1. Within band of `expectedRuntime` → likely uncut version of this release. No flag.
2. Within band of `(expectedRuntime - cutsRemovedSeconds)` → likely the cut/censored version. **Flag with explanation.**
3. Neither → mismatch (wrong release entirely, wrong PAL/NTSC variant, etc.). Flag with a different reason.

The output is a dry-run report — the command does not mutate the file, move it, or pick a side. The user reviews and acts.

## Your Mission

### 1. New tool — `parseDvdCompareCuts`

New file: `packages/server/src/tools/parseDvdCompareCuts.ts`. Mirror [parseSpecialFeatures.ts](../../packages/server/src/tools/parseSpecialFeatures.ts) structurally:

- Pure function: input is the raw HTML string, output is a structured TypeScript object.
- Use the same HTML parser the special-features parser uses (grep `parseSpecialFeatures.ts` for the import — most likely `cheerio` or `node-html-parser`; pick whichever is already in `package.json` for `@mux-magic/server`).
- Return shape:

```ts
type DvdCompareCutsResult = {
  expectedRuntimeSeconds: number | null  // From the page's listed runtime
  cuts: Array<{
    timecode: string | null              // As printed; raw, not normalized
    description: string                  // The cut's blurb
    removedSeconds: number               // Per-cut delta
  }>
  totalRemovedSeconds: number            // Sum of cuts[].removedSeconds
}
```

- Be defensive: if the cuts table is absent (most releases don't have one), return `cuts: []` and `totalRemovedSeconds: 0` rather than throwing. Distinguish "no cuts table" from "cuts table failed to parse" — the latter is a real error.
- No `.push` mutation per the repo's array-mutation ban — build `cuts` via `Array.from(rows).map(...)` or reduce.

### 2. HTML fixtures

Web scrapers break silently when the source site changes; the only defense is fixture-driven snapshot testing. Add fixtures under [packages/server/src/tools/__fixtures__/](../../packages/server/src/tools/__fixtures__/) (the same dir that already holds `dvdcompare-soldier-4k-74759.html`):

- `dvdcompare-cuts-uncut-release.html` — a real DVDCompare page for a release whose cuts table is empty (most releases). Confirms the "no cuts table" code path returns `cuts: []` cleanly.
- `dvdcompare-cuts-censored-release.html` — a real DVDCompare page for a release with a populated cuts table (e.g. an anime regional-censor release or a film with a US-vs-international cut). The fixture exercises the row-walking logic with multiple cuts including ones missing a timecode.
- Save the HTML byte-identical to what `fetch` returns — do not pretty-print or run through a formatter. Brittleness is the point of fixture-driven tests; reformatting masks real selector changes.

The user-facing fetch path (in production) still uses [searchDvdCompare.ts](../../packages/server/src/tools/searchDvdCompare.ts) to retrieve the release page. The new tool consumes the HTML; tests load it from `__fixtures__`.

### 3. New app-command — `detectPotentialCensorship`

New file: `packages/server/src/app-commands/detectPotentialCensorship.ts`. Inputs:

| Field | Type | Default | Notes |
|---|---|---|---|
| `sourcePath` | path | required | File or folder. Reuses the canonical `sourcePath` field per worker 24. |
| `isRecursive` | boolean | `false` | When `sourcePath` is a folder, recurse for video files. |
| `recursiveDepth` | number | `0` (unlimited) | Mirrors the existing convention. |
| `dvdCompareId` | dvdCompareId Variable link | required | The release whose cuts table to compare against. Reuses the Variable type from worker 35. |
| `toleranceSeconds` | number | `2` | The ±tolerance band for matching against `expectedRuntime` or `expectedRuntime - cutsRemovedSeconds`. |

Pipeline:

1. Resolve `dvdCompareId` → fetch the release HTML via `searchDvdCompare` (or its sibling fetch helper — re-read post-22 NSF code for the canonical fetch entry point).
2. Parse the HTML with `parseDvdCompareCuts`.
3. For each video file under `sourcePath`, get its duration via `getFileDuration`.
4. Classify each file as: `uncut-match` | `cut-match` | `mismatch` | `no-cuts-table-on-release`.
5. Emit a structured log line per file with the classification + delta. Compose with the existing `logInfo` / `logWarning` shapes from `@mux-magic/tools`.

This is dry-run only. No file moves, no edition tags, no mutations. The output composes with the user's existing review workflow.

### 4. Schema + UI registration

- [packages/server/src/api/schemas.ts](../../packages/server/src/api/schemas.ts) — `detectPotentialCensorshipRequestSchema`. Validate `toleranceSeconds >= 0`.
- [packages/server/src/api/routes/commandRoutes.ts](../../packages/server/src/api/routes/commandRoutes.ts) — register; tag `"Detection"` or whichever existing tag groups dry-run detection commands like `hasDuplicateMusicFiles`.
- [packages/web/src/commands/commands.ts](../../packages/web/src/commands/commands.ts) — UI metadata, summary, field rendering.
- [packages/web/src/jobs/commandLabels.ts](../../packages/web/src/jobs/commandLabels.ts) — human label, e.g. `"Detect Potential Censorship (DVDCompare cuts)"`.
- CLI subcommand: `packages/cli/src/cli-commands/detectPotentialCensorshipCommand.ts` following the existing yargs pattern.

The `dvdCompareId` field is a Variable link, not a string. Reuse the worker 35 NumberWithLookupField / DVD Compare ID link picker — do not invent a parallel input.

## Tests / TDD

Two-commit pattern: failing red commit first, then green implementation.

1. **`parseDvdCompareCuts` — release with no cuts table** — load `dvdcompare-cuts-uncut-release.html`; assert `cuts: []`, `totalRemovedSeconds: 0`, `expectedRuntimeSeconds` is the page's listed value (or `null` if missing).
2. **`parseDvdCompareCuts` — release with cuts** — load `dvdcompare-cuts-censored-release.html`; assert `cuts.length` matches the visible rows in the fixture; assert `totalRemovedSeconds` equals the sum of per-cut deltas; assert one row that lacks a timecode in the fixture parses with `timecode: null` not a thrown error.
3. **`parseDvdCompareCuts` — malformed input** — pass `"<html></html>"` (a real HTML doc but with no expected selectors); assert it returns `cuts: []` with `expectedRuntimeSeconds: null` rather than throwing.
4. **`detectPotentialCensorship` — uncut-match** — mock `getFileDuration` to return `expectedRuntime`; assert classification `uncut-match`.
5. **`detectPotentialCensorship` — cut-match** — mock `getFileDuration` to return `expectedRuntime - totalRemovedSeconds`; assert classification `cut-match`.
6. **`detectPotentialCensorship` — mismatch** — mock duration to neither; assert classification `mismatch`.
7. **`detectPotentialCensorship` — tolerance edge** — duration exactly at `expectedRuntime + toleranceSeconds`: matches. At `expectedRuntime + toleranceSeconds + 1`: doesn't match.
8. **`detectPotentialCensorship` — recursive folder** — three video files in a tmp dir, two classifications differ; assert one report line per file.
9. **Schema validation** — rejects `toleranceSeconds: -1`; accepts the happy path.
10. **Web parity fixture** — `packages/web/tests/fixtures/parity/detectPotentialCensorship.input.json` + `.yaml` round-trip cleanly through `yamlCodec`.

## Files

### New

- [packages/server/src/tools/parseDvdCompareCuts.ts](../../packages/server/src/tools/parseDvdCompareCuts.ts)
- [packages/server/src/tools/parseDvdCompareCuts.test.ts](../../packages/server/src/tools/parseDvdCompareCuts.test.ts)
- [packages/server/src/tools/__fixtures__/dvdcompare-cuts-uncut-release.html](../../packages/server/src/tools/__fixtures__/dvdcompare-cuts-uncut-release.html)
- [packages/server/src/tools/__fixtures__/dvdcompare-cuts-censored-release.html](../../packages/server/src/tools/__fixtures__/dvdcompare-cuts-censored-release.html)
- [packages/server/src/app-commands/detectPotentialCensorship.ts](../../packages/server/src/app-commands/detectPotentialCensorship.ts)
- [packages/server/src/app-commands/detectPotentialCensorship.test.ts](../../packages/server/src/app-commands/detectPotentialCensorship.test.ts)
- [packages/cli/src/cli-commands/detectPotentialCensorshipCommand.ts](../../packages/cli/src/cli-commands/detectPotentialCensorshipCommand.ts)
- [packages/web/tests/fixtures/parity/detectPotentialCensorship.input.json](../../packages/web/tests/fixtures/parity/detectPotentialCensorship.input.json)
- [packages/web/tests/fixtures/parity/detectPotentialCensorship.yaml](../../packages/web/tests/fixtures/parity/detectPotentialCensorship.yaml)

### Modified

- [packages/server/src/api/schemas.ts](../../packages/server/src/api/schemas.ts) — `detectPotentialCensorshipRequestSchema`
- [packages/server/src/api/routes/commandRoutes.ts](../../packages/server/src/api/routes/commandRoutes.ts) — register command + OpenAPI surface
- [packages/web/src/commands/commands.ts](../../packages/web/src/commands/commands.ts) — UI registration with `dvdCompareId` link field
- [packages/web/src/jobs/commandLabels.ts](../../packages/web/src/jobs/commandLabels.ts) — display label
- [packages/cli/src/cli.ts](../../packages/cli/src/cli.ts) — wire the new CLI subcommand

### Reuse — do not reinvent

- HTML parsing: copy the import + idiom from [parseSpecialFeatures.ts](../../packages/server/src/tools/parseSpecialFeatures.ts) — same parser, same defensive style, same snapshot-test pattern.
- Fetching the release page: [searchDvdCompare.ts](../../packages/server/src/tools/searchDvdCompare.ts) (or whichever sibling helper the post-22/3a NSF code uses to retrieve a release URL).
- Duration: [packages/server/src/tools/getFileDuration.ts](../../packages/server/src/tools/getFileDuration.ts) is the canonical wrapper — do not spawn `ffprobe` directly.
- Variable link picker: the worker 35 DVD Compare ID component — render it through the existing field schema, not a bespoke text input.

## Verification

- [ ] Standard gates clean: `yarn lint → yarn typecheck → yarn test → yarn test:e2e → yarn lint`
- [ ] All TDD tests pass (red commit visible in `git log` before green)
- [ ] Failing-test commit landed before the implementation commit
- [ ] Both HTML fixtures saved byte-identical to the live page response (no formatter pass)
- [ ] Manual smoke: against a release the user knows has a cuts table (e.g. a censored anime regional release the user owns), with the local file pointed at both the uncut master and a known cut copy, confirm the classification flips correctly
- [ ] `chore(manifest):` commit flips [docs/workers/MANIFEST.md](MANIFEST.md) row 52 to `done` after merge (separate commit — never bundled with code)
- [ ] PR opened against `feat/mux-magic-revamp`

## Out of scope

- **Acting on the classification.** This command produces a dry-run report. Moving cut files into a `_cut/` folder, tagging them with an edition string, deleting them, or merging the uncut version in — all of that is downstream and not part of this PR.
- **Releases with no cuts table.** When DVDCompare hasn't published a cuts table for the release, the command emits `no-cuts-table-on-release` per file and exits cleanly. It does not try to scrape elsewhere or guess from runtime alone.
- **Non-DVDCompare cuts sources.** No Movie-censorship.com integration, no Wikipedia "Differences between versions" scrape. DVDCompare is the chosen single source of truth here.
- **Edition organization.** Worker 26 (`nsf-edition-organizer`) owns edition-aware directory layout. This worker only flags; it does not organize.
- **Tuning `parseSpecialFeatures`.** That tool is reused by reference but not modified.
