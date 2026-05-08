# Subtitle modification: JS heuristic vs YAML DSL coverage

## Why this doc exists

Before media-sync was migrated to drive media-tools by sequence-step JSON, all
default ASS-subtitle "fixups" were computed client-side by a single function
called `buildDefaultSubtitleModificationRules`. That function read every
`.ass` file's `[Script Info]` plus `[V4+ Styles]` metadata, ran a small
heuristic over the aggregate, and returned an `AssModificationRule[]` array
that the legacy `modifySubtitleMetadata` ingested.

In the migration, the engine half (`modifySubtitleMetadata`) became a generic
DSL interpreter that takes a list of declarative rules. The heuristic half
moved server-side into `computeDefaultSubtitleRules`, a separate sequence
step that reads metadata and emits a fully-resolved rules array, and is then
piped into `modifySubtitleMetadata` over the sequence wire via
`{ linkedTo: "computeRules", output: "rules" }`.

This doc maps the eight original JS branches against the three rule types
the YAML/JSON DSL exposes today, calls out what the DSL can and cannot
declaratively express, and recommends a path forward.

## TL;DR

The DSL is **structurally sufficient** for the three "shape" things the
heuristic emits (ScriptType pin, YCbCr Matrix override, MarginV/L/R and
optional resolution rescale). It is **not** sufficient for any of the five
"should this rule even fire?" or "what number goes in this field?"
decisions the heuristic currently makes. Those decisions have moved into
TypeScript (`computeDefaultSubtitleRules` in media-tools), not into YAML.

We recommend keeping it that way (Road A below).

## Side-by-side: 8 JS branches → DSL coverage

Source: `src/tools/buildDefaultSubtitleModificationRules.ts`. Line numbers
refer to that file at the time of writing.

| # | JS branch (line)                                                                    | DSL coverage                                          | Equivalent YAML / GAP                                                                                              |
| - | ----------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1 | `rules.push({ type: "setScriptInfo", key: "ScriptType", value: "v4.00+" })` (L22)   | DIRECT                                                | `- type: setScriptInfo`<br/>`  key: ScriptType`<br/>`  value: v4.00+`                                              |
| 2 | `hasIncorrectColorspace = …some(YCbCr Matrix === "TV.601" && !(640x480))` (L24-L27) | GAP — aggregate predicate over all files              | DSL has no `when:` clause and no compound `(scriptInfo.X && !(scriptInfo.Y))`. Today this gating lives in TS only. |
| 3 | `setScriptInfo YCbCr Matrix → TV.709` (L30)                                         | DIRECT (when emitted)                                 | `- type: setScriptInfo`<br/>`  key: "YCbCr Matrix"`<br/>`  value: TV.709`                                          |
| 4 | `hasIncorrectResolution` (hard-coded `false`, was 640x360 detect) (L36)             | GAP — emission-gating predicate                       | The `scaleResolution.from:` guard skips per-file, but cannot stop the rule from being emitted at all.              |
| 5 | `scaleResolution from 640×360 to 1920×1080` (L39-L48 + the L36 gate)                | DIRECT shape (currently dead-coded)                   | `- type: scaleResolution`<br/>`  from: { width: 640, height: 360 }`<br/>`  to: { width: 1920, height: 1080 }`<br/>`  hasScaledBorderAndShadow: true` |
| 6 | `marginV = round(targetHeight/1080 * 90)` (L49)                                     | GAP — computed value from PlayResY                    | DSL fields are static strings; no `${expr}` template, no first-file metadata reference.                            |
| 7 | `marginLRValue / marginLRThreshold = round(200/1920 * width)` (L50-L51)             | GAP — same as #6                                      | Same.                                                                                                              |
| 8 | `needsMarginLR = …some(styles…some(non-ignored && MarginL/R < threshold))` (L54-L65)| GAP — per-style aggregate predicate w/ ignored regex  | DSL's `ignoredStyleNamesRegexString` only **protects** styles from being written; it cannot **detect** them.       |

## What the DSL CAN reproduce today (static 1920×1080 case)

For a series whose `.ass` files are already 1920×1080 with TV.709 Matrix,
this is the rules array a user could hand-write today. It captures rules
1, 3, and the *shape* of 5 (commented out because the in-tree heuristic
disables it):

```yaml
rules:
  # Branch 1 — always pin ScriptType.
  - type: setScriptInfo
    key: ScriptType
    value: v4.00+

  # Branch 3 — force TV.709 colorspace.
  # In the JS heuristic this is gated by branch 2 (any file has TV.601
  # outside 640x480). The DSL cannot express that gate, so emitting this
  # rule statically means it ALWAYS fires — fine for sources that are
  # already TV.709 (idempotent overwrite), wrong for true 640x480 SD-DVD.
  - type: setScriptInfo
    key: "YCbCr Matrix"
    value: TV.709

  # Branch 5 — rescale from 640x360 to 1920x1080. Use `from:` so the rule
  # is a no-op on files that aren't 640x360. Disabled by default because
  # the in-tree port hard-codes hasIncorrectResolution=false.
  # - type: scaleResolution
  #   from: { width: 640, height: 360 }
  #   to: { width: 1920, height: 1080 }
  #   hasScaledBorderAndShadow: true

  # Branches 6-8 — margin fixups. Static-only: the user must pre-compute
  # MarginV from their known target height and decide for themselves
  # whether MarginL/R need fixing. The ignored-names regex still protects
  # signs/songs from being overwritten.
  - type: setStyleFields
    fields:
      MarginV: "90"
      # MarginL: "200"   # uncomment if your styles are too narrow
      # MarginR: "200"
    ignoredStyleNamesRegexString: "signs?|op|ed|opening|ending"
```

This loses everything the heuristic does dynamically: the
sub-1080p MarginV scaling, the SD-DVD carve-out, the per-style
threshold check, the resolution-gated colorspace check, and the
640×360 detection.

## GAPs (what the DSL cannot express today)

### G1. Aggregate predicates: "emit iff ANY file has X"

JS branches 2 and 8. The current DSL has no rule-level guard; a rule in
the YAML always emits. The "any file in the batch has the bad value, so
all files get the fix" decision lives in TS.

**Proposed schema addition** (additive, opt-in, all rule types):

```yaml
- type: setScriptInfo
  key: "YCbCr Matrix"
  value: TV.709
  when:
    anyScriptInfo:
      "YCbCr Matrix": TV.601
    notAllScriptInfo:
      PlayResX: "640"
      PlayResY: "480"
```

Predicate vocabulary kept deliberately small: `anyScriptInfo`,
`allScriptInfo`, `noneScriptInfo` matching against literal strings; same
trio for `anyStyle` over the styles section. No expressions, no
`< > !=` operators in the DSL — all comparisons are equality of
string-typed fields.

### G2. Computed values from first-file metadata

JS branches 6 and 7 derive `MarginV`, `MarginL`, `MarginR`, and the
threshold from `firstScriptInfo.PlayResX/Y`. The DSL has no template
syntax, so `MarginV: "90"` is the only thing one can write today.

A `${expr}` mini-language scoped to first-file metadata
(`${round(playResY/1080*90)}`) would close this, **but** it expands the
DSL into "small programming language" territory: arithmetic, function
calls, evaluation order, sandboxing. We recommend NOT adding this and
keeping computed values in `computeDefaultSubtitleRules` instead.

### G3. Per-style aggregate predicates

JS branch 8: "any non-ignored style across any file has MarginL/R below
threshold." The DSL's `ignoredStyleNamesRegexString` is a *write-time*
guard (don't overwrite signs/songs); it cannot drive whether a field is
included in `fields:` at all.

**Proposed schema addition**: `setStyleFields.applyIf` with an
`anyStyleMatches` predicate that has access to a comparator vocabulary
(`lt`, `gt`, `eq`). This is strictly more powerful than G1's literal-only
matchers and is the place where complexity sneaks in fastest.

### G4. 640×480 SD-DVD carve-out

JS branch 2 already encodes a compound predicate: `TV.601 && !(640×480)`.
A naïve G1 design that only supports `any/all/none` over equality would
need to express this as "emit iff (any has TV.601) AND (not all are
640×480)" — which is plausible but where the truth-table starts to grow.
Solvable as a corollary of G1 with `notAllScriptInfo`.

### G5. Resolution-conditional `scaleResolution`

The `from:` guard makes `scaleResolution` a per-file no-op when the file
doesn't match. That's NOT the same as the JS branch 4 gate, which decides
**whether to emit the rule at all** based on aggregate metadata. Once G1
exists, this is a single `when: { anyScriptInfo: { PlayResX: "640",
PlayResY: "360" } }` away.

## Where the dynamic logic actually lives

It lives **server-side, in TypeScript**, not in YAML.

- `src/tools/buildDefaultSubtitleModificationRules.ts` — the in-tree
  port. Note: `hasIncorrectResolution` is hard-coded `false` here, so
  branches 4 and 5 are dead by default; the comment explains this is a
  deliberate 1:1 port that preserves the original TODO.
- `src/app-commands/computeDefaultSubtitleRules.ts` — sequence step.
  Calls `getSubtitleMetadata` then runs the heuristic and emits the
  fully-resolved `AssModificationRule[]` as its `rules` output.

**The `linkedTo` pipe pattern.** In a media-sync sequence body, the
rules-producing step and the rules-consuming step are wired like this:

```ts
{
  id: "computeRules",
  command: "computeDefaultSubtitleRules",
  params: { sourcePath: …, isRecursive: true },
},
{
  id: "applyRules",
  command: "modifySubtitleMetadata",
  params: {
    sourcePath: …,
    rules: { linkedTo: "computeRules", output: "rules" },
  },
},
```

`{ linkedTo, output }` is resolved by the sequence runner: it pulls the
named output field from the prior step's results and substitutes it
inline before invoking the consumer. The consumer (`modifySubtitleMetadata`)
sees an ordinary `rules: AssModificationRule[]` and can't tell whether
the rules were typed by hand into YAML or computed by another step.

This is the migration's actual answer to "how do dynamic, metadata-aware
rules get into a static-DSL engine": they don't — a sibling command
computes them and pipes them in.

## Test strategy

### Existing coverage (keep green)

- `src/tools/buildDefaultSubtitleModificationRules.test.ts` — 9 cases,
  one per JS branch (ScriptType pin, YCbCr correction, SD-DVD exception,
  MarginV from PlayResY, sub-1080p MarginV, MarginL/R threshold,
  ignored-name regex, missing-PlayRes default, empty-array safety).
- `src/app-commands/modifySubtitleMetadata.test.ts` — empty-rules
  no-op + per-file `{ filePath }` emission. Exercises the
  `setScriptInfo` rule type end-to-end through the engine.
- `src/tools/assFileTools.test.ts` — round-trip parse/serialize on real
  Crunchyroll-shaped samples. Underpins all three rule types since
  every rule writes through this serializer.

### Recommended new fixtures (out of scope for this PR; track as
follow-ups under the GAP work):

- **G4 SD-DVD carve-out**: 640×480 `.ass` with TV.601 — must NOT emit
  YCbCr fix. Currently covered as a unit test in
  `buildDefaultSubtitleModificationRules.test.ts` but not as an
  end-to-end DSL fixture; promote to `applyAssRules` integration when
  G1 lands.
- **`scaleResolution` with existing LayoutResX/Y**: 640×360 `.ass`
  with `LayoutResX/Y` already present — should rewrite both via
  `isLayoutResSynced`. No existing fixture exercises this branch.
- **Mixed-margin sample**: episode A has `Default` style with
  `MarginL=0`, episode B has `Signs` style with `MarginL=0`. Only the
  `Default` one should trigger an `MarginL/R` field in the emitted
  rule. Already unit-tested at the heuristic level; missing as an
  end-to-end sequence fixture.
- **Empty `.ass` folder**: sequence (`computeDefaultSubtitleRules` →
  `modifySubtitleMetadata`) must complete without throwing. Engine
  no-op is already covered; add a sequence-level fixture exercising
  the `linkedTo` wire when upstream emits `[]`.
- **End-to-end `linkedTo` chain**: a sequence test that runs
  `computeDefaultSubtitleRules` → `modifySubtitleMetadata` and
  verifies the resolved-rules list reaches the consumer. Today this
  wire is exercised only in production by media-sync's
  `processAnimeSubtitles`.

## Recommendation: Road A

Two paths forward:

- **Road A** (recommended): heuristics stay in TypeScript commands
  alongside `computeDefaultSubtitleRules`. Add new command (e.g.
  `computeFontFixupRules`) when a new heuristic is needed. The DSL
  remains declarative-static and trivial to validate with Zod.
- **Road B**: extend the DSL with `when:` predicates and `${expr}`
  expressions so the entire heuristic becomes user-editable YAML.

We recommend Road A, with one carefully scoped DSL extension: add G1
(`when:` aggregate predicates, equality-only) so users can author static
YAML that includes self-gating rules without invoking a TS command.
That captures the most common "should this even fire?" question while
sidestepping the expression-language can of worms (G2). G3, G4 fall
out of G1 once it exists. Computed values (G2) and per-style threshold
predicates that need comparators (G3 with operators) stay in
`computeDefaultSubtitleRules`.

This keeps the DSL surface small, the validation story clean, and the
"smart" defaults reproducible and unit-testable in isolation while still
giving advanced users a way to describe gated static rules in YAML.
