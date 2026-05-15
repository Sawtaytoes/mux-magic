# Worker 43 — builder-seqjson-param

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/43-builder-seqjson-param`
**Worktree:** `.claude/worktrees/43_builder-seqjson-param/`
**Phase:** 1B web (follow-up)
**Depends on:** 01
**Parallel with:** other 1B web workers (touches `BuilderPage.tsx`, `buildBuilderUrl.ts`, sibling new files — disjoint from active workers)

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your Mission

Shrink the Builder's shareable / live-syncing URL by switching the encoded payload to **minified JSON + base64url** under a **new query parameter `?seqJson=`**. The old `?seq=` parameter (legacy YAML or JSON, base64-with-padding) keeps decoding for backward compatibility.

**Compression is explicitly NOT in scope.** A separate committed `vitest bench` measures YAML vs JSON, raw and gzipped, so the *future* compression decision has data behind it. This PR only changes the format/encoding of new URLs.

### Why

[BuilderPage.tsx:110-142](../../packages/web/src/pages/BuilderPage/BuilderPage.tsx#L110-L142) writes the entire sequence to the URL on every keystroke (synchronously — that's load-bearing for F5 safety, see the comment at [BuilderPage.tsx:91-109](../../packages/web/src/pages/BuilderPage/BuilderPage.tsx#L91-L109)). Today it serializes via `toYamlStr` (verbose YAML with newlines + indent) then base64-encodes it. Even modest sequences produce multi-KB URLs. Switching the live writer to **minified `JSON.stringify` + base64url** is a large reduction with zero new async surface and zero infrastructure additions.

Using a **distinct query param name** (rather than payload-sniffing inside `?seq=`) keeps format dispatch trivial and leaves the door open for future `?seqGz=`/etc. without breaking decoder logic.

## Out of scope

- `CompressionStream` / gzip in production code paths. (The bench file uses it for measurement only.)
- The `beforeunload` "saving in background…" confirm dialog — only relevant once we add async compression.
- Any change to YAML clipboard / load modal / save flow. Clipboard, [LoadModal](../../packages/web/src/components/LoadModal/LoadModal.tsx), [YamlModal](../../packages/web/src/components/YamlModal/YamlModal.tsx), and the YAML codec itself are **untouched**.
- `loadYamlFromText`, `toYamlStr`, [yamlCodec.ts](../../packages/web/src/jobs/yamlCodec.ts) — untouched (except possibly an internal extraction; see "Sequence-shape JSON helper" below).

## What changes

### 1. New query parameter `?seqJson=`

| Param         | Producer                                              | Payload                                                |
| ------------- | ----------------------------------------------------- | ------------------------------------------------------ |
| `?seq=`       | _none new_ — preserved for legacy URLs only           | `btoa(unescape(encodeURIComponent(yaml-or-json)))`     |
| `?seqJson=`   | New live writer + updated `buildBuilderUrl`           | `base64url(JSON.stringify({paths, steps}))`            |

Format dispatch is by **param name**, not payload sniffing.

### 2. Live URL writer (BuilderPage)

Update the writer at [BuilderPage.tsx:110-142](../../packages/web/src/pages/BuilderPage/BuilderPage.tsx#L110-L142):

- Build the same `{paths, steps}` shape that `toYamlStr` builds (so `loadYamlFromText` works identically on the round-trip).
- Serialize with `JSON.stringify(...)` — no spaces, single line.
- Encode via the new `encodeSeqJsonParam(json)` (UTF-8 → base64url, no padding).
- Write to `?seqJson=`. Also `searchParams.delete("seq")` so a stale legacy param isn't carried alongside.

The writer **stays synchronous** — that is the entire point of avoiding compression in this PR. The F5-safety rationale comment at [BuilderPage.tsx:91-109](../../packages/web/src/pages/BuilderPage/BuilderPage.tsx#L91-L109) remains accurate; do not rewrite it.

### 3. Reader (BuilderPage mount effect)

Update [BuilderPage.tsx:55-89](../../packages/web/src/pages/BuilderPage/BuilderPage.tsx#L55-L89):

- Read `?seqJson=` first; if present and `decodeSeqJsonParam(...)` returns non-null, use that.
- Otherwise fall back to `?seq=` and the existing `decodeSeqParam(...)` path (current behavior).
- Either decoded text feeds `loadYamlFromText` (JSON is valid YAML — see comment at [buildBuilderUrl.ts:5](../../packages/web/src/jobs/buildBuilderUrl.ts#L5)). No second parser path needed.

### 4. `buildBuilderUrl` (JobCard "re-edit")

Update [buildBuilderUrl.ts](../../packages/web/src/jobs/buildBuilderUrl.ts) to emit `?seqJson=` via the new encoder. Output drops `btoa(unescape(encodeURIComponent(JSON.stringify(...))))` for `base64url(JSON.stringify(...))` — typically a few bytes shorter and avoids `encodeURIComponent` having to escape `+` and `/`. Update the existing rationale comment to reference the new param name.

## Files

- **New:** `packages/web/src/jobs/encodeSeqJsonParam.ts` — sync, `(json: string) => string`, base64url no padding.
- **New:** `packages/web/src/jobs/decodeSeqJsonParam.ts` — sync, `(encoded: string | null | undefined) => string | null`, returns `null` on malformed input.
- **New (helper):** `packages/web/src/jobs/base64url.ts` — `toBase64Url(bytes: Uint8Array): string` and `fromBase64Url(str: string): Uint8Array | null`. Wraps btoa/atob with the standard `+/=` ↔ `-_` swap and padding strip. Tested independently.
- **Modify:** [packages/web/src/jobs/buildBuilderUrl.ts](../../packages/web/src/jobs/buildBuilderUrl.ts) — emit `?seqJson=`.
- **Modify:** [packages/web/src/pages/BuilderPage/BuilderPage.tsx](../../packages/web/src/pages/BuilderPage/BuilderPage.tsx) — mount effect prefers `?seqJson=`, falls back to `?seq=`. Live writer emits `?seqJson=` and clears `?seq=`.
- **Add header note (one line):** [packages/web/src/jobs/encodeSeqParam.ts](../../packages/web/src/jobs/encodeSeqParam.ts) and [packages/web/src/jobs/decodeSeqParam.ts](../../packages/web/src/jobs/decodeSeqParam.ts) — mark as "legacy-only, kept for backward decoding of `?seq=`."
- **Untouched:** [packages/web/src/jobs/yamlCodec.ts](../../packages/web/src/jobs/yamlCodec.ts), all YAML modals, all save/load paths.

## Sequence-shape JSON helper

The live writer needs the same `{paths, steps}` object shape that `toYamlStr` builds (so the reader's `loadYamlFromText` works identically). Two viable approaches:

1. **Extract** `buildSequenceObject(steps, paths, commands)` from the upper half of [yamlCodec.ts](../../packages/web/src/jobs/yamlCodec.ts) so both `toYamlStr` and the new JSON encoder share it. Cleanest. The extraction is mechanical: pull the `stepToYaml` / `groupToYaml` helpers and the top-level paths/steps assembly into a pure shape function; `toYamlStr` becomes `dump(buildSequenceObject(...), {...})`.
2. **Wrap/duplicate** — call the same shaping logic inline in the new encoder. Slight duplication.

Default to option 1 unless the extraction is unexpectedly invasive (e.g. tightly coupled to `js-yaml`'s `dump` options). If you go with option 1, add a focused unit test for `buildSequenceObject` covering: top-level paths object, mixed steps + groups, parallel groups, collapsed flag, blank steps preserved, alias preserved.

## Tests

### Unit tests (new, TDD-failing-first)

- `encodeSeqJsonParam.test.ts` — round-trip ASCII + Unicode + empty + emoji; output regex `/^[A-Za-z0-9_-]*$/` (base64url alphabet, no padding); known-vector test against one fixed input.
- `decodeSeqJsonParam.test.ts` — null/undefined/empty → `null`; malformed base64url → `null`; legacy base64-with-`+`/`/` → `null` (deliberately refuse mixed-alphabet input rather than silently accepting it).
- `base64url.test.ts` — round-trip + boundary cases (1, 2, 3 byte inputs hit each padding length); decode rejects characters outside the base64url alphabet.

### Integration tests (extend [buildBuilderUrl.test.ts](../../packages/web/src/jobs/buildBuilderUrl.test.ts))

- URL now matches `/^\/builder\?seqJson=/`.
- Round-trips through `decodeSeqJsonParam` → `loadYamlFromText` (assertions identical to existing ones).
- **Legacy compatibility test**: a hand-constructed `?seq=` (legacy YAML payload) still decodes via `decodeSeqParam` → `loadYamlFromText`. This pins the fallback contract that the reader relies on.

[decodeSeqParam.test.ts](../../packages/web/src/jobs/decodeSeqParam.test.ts) and [encodeSeqParam.test.ts](../../packages/web/src/jobs/encodeSeqParam.test.ts) stay unchanged — they guard the legacy fallback.

### Bench test (new, committed)

`packages/web/src/jobs/seqEncoding.bench.ts` — `vitest bench`. Across a fixture set:

- Empty sequence (paths only).
- 1-step `flattenOutput`.
- 10-step typical (mix of commands + a group + 2 path variables).
- 50-step large.
- 100-step stress.

For each fixture, report length (URL-safe characters, post-`encodeURIComponent` where applicable) of:

| Format                                 | Notes                                   |
| -------------------------------------- | --------------------------------------- |
| YAML raw                               | `toYamlStr(...)`                        |
| JSON raw (minified)                    | `JSON.stringify(...)`                   |
| YAML + base64                          | current `?seq=` size                    |
| JSON + base64url                       | new `?seqJson=` size                    |
| YAML + gzip + base64url                | future option                           |
| JSON + gzip + base64url                | future option                           |

Use `CompressionStream` for the gzip rows (Node 20+ supports it natively). The bench is informational — assert nothing strict, just emit a readable table via `console.log` inside a `bench(...)` block (or a plain `test(...)` if vitest's bench runner doesn't surface output cleanly). The artifact answers "should we eventually compress, and if so what source format?".

Wire the bench into the existing vitest config so it runs as part of the standard suite (or add a `yarn workspace @mux-magic/web bench` script if benches need their own runner — check existing `vitest.config.ts` first).

## TDD steps

1. Create worktree + branch + flip manifest row to `in-progress`.
2. Write failing tests for `base64url.ts`, `encodeSeqJsonParam.ts`, `decodeSeqJsonParam.ts` (unit) — commit.
3. Implement those three files. Tests pass.
4. (If extracting) Write failing test for `buildSequenceObject`; implement extraction in `yamlCodec.ts`; verify existing yamlCodec tests still pass.
5. Update `buildBuilderUrl.ts`. Update its tests (param name + legacy compat test).
6. Update `BuilderPage.tsx` (mount reader + live writer). Manual verification per checklist.
7. Add the bench file. Run it; sanity-check the size table looks reasonable.
8. Standard pre-merge gate.
9. Open PR; flip manifest row to `done` after merge.

## Verification checklist

- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Failing tests committed first
- [ ] `?seqJson=` URLs are meaningfully shorter than master `?seq=` URLs (paste a representative sequence; eyeball)
- [ ] Refresh on a `?seqJson=` URL restores the sequence intact
- [ ] A known legacy `?seq=` URL (grab one from before this change) still loads via the fallback path
- [ ] JobCard "re-edit" produces a `?seqJson=` URL that opens correctly
- [ ] YAML modal export (load/save) still produces YAML, untouched
- [ ] Bench file runs and prints the size table
- [ ] Standard gate clean (lint → typecheck → test → e2e → lint)
- [ ] PR opened
- [ ] Manifest row → `done`
