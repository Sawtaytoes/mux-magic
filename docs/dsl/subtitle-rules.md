# Subtitle modification DSL — reference

The `modifySubtitleMetadata` command takes a list of declarative **rules** that transform `.ass` subtitle files. The rules are pure data (no expressions, no scripting); the engine in `src/tools/applyAssRules.ts` walks the list and applies each rule in order.

Two ways to feed rules in:

1. **Hand-author** them in YAML/JSON inside a sequence step's `params.rules`.
2. **Compute** them at runtime via `computeDefaultSubtitleRules` and pipe via `{ linkedTo, output }` (see [subtitle-coverage.md](subtitle-coverage.md) for that side).

This doc is the **authoring reference** — every rule type, every field, what they do, and the patterns that actually show up.

---

## Top-level shape

```yaml
predicates:               # OPTIONAL. Named compound conditions reused below.
  isSdDvd:
    "YCbCr Matrix": TV.601
    PlayResX: "640"
    PlayResY: "480"
  isHd1080:
    PlayResX: "1920"
    PlayResY: "1080"

rules:                    # REQUIRED. Ordered list of rules to apply.
  - type: setScriptInfo
    ...
  - type: scaleResolution
    ...
  - type: setStyleFields
    ...
```

**Order matters.** Rules apply top-to-bottom per file. Later rules see the output of earlier ones.

---

## Rule types

Three types today: `setScriptInfo`, `scaleResolution`, `setStyleFields`.

### `setScriptInfo`

Sets a single key in the `[Script Info]` section. If the key doesn't exist, it's appended after the last existing property.

```yaml
- type: setScriptInfo
  key: "YCbCr Matrix"           # Case-sensitive.
  value: "TV.709"
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `type` | `"setScriptInfo"` | yes | Discriminator. |
| `key` | string | yes | Case-sensitive `[Script Info]` key (e.g. `ScriptType`, `YCbCr Matrix`, `PlayResX`, `PlayResY`, `LayoutResX`, `LayoutResY`). |
| `value` | string | yes | Always a string. ASS files store numbers as strings. |
| `when` | predicate | no | See [`when:` predicates](#when-predicates). When omitted, the rule always fires. |

### `scaleResolution`

Rescales `PlayResX`/`PlayResY` and proportionally rewrites every style's font sizes, margins, outline, shadow, and `LayoutResX/Y` if present. Skipped per-file if the file's resolution doesn't match `from`.

```yaml
- type: scaleResolution
  from: { width: 640, height: 360 }
  to: { width: 1920, height: 1080 }
  hasScaledBorderAndShadow: true   # default true
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `type` | `"scaleResolution"` | yes | Discriminator. |
| `from` | `{ width: number, height: number }` | yes | Per-file guard. Files whose `PlayResX`/`PlayResY` don't match are left alone. |
| `to` | `{ width: number, height: number }` | yes | Target resolution. Style numerics scale by `to/from` ratio. |
| `hasScaledBorderAndShadow` | boolean | no (default `true`) | Whether `[Script Info]` `ScaledBorderAndShadow: yes` is also written. |
| `when` | predicate | no | Aggregate-batch gate. Independent of the per-file `from:` match. |

### `setStyleFields`

Overwrites named fields in `[V4+ Styles]` rows. Optionally protects styles whose `Name` matches a regex from being overwritten.

```yaml
- type: setStyleFields
  fields:
    MarginV: "90"
    MarginL: "200"
    MarginR: "200"
  ignoredStyleNamesRegexString: "signs?|op|ed|opening|ending"
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `type` | `"setStyleFields"` | yes | Discriminator. |
| `fields` | `Record<string, string \| computeFrom>` | yes | Field name → value. String literal OR a `computeFrom` block (see [Computed values](#computed-values)). |
| `ignoredStyleNamesRegexString` | string | no | If set, styles whose `Name` field matches the regex are NOT modified (case-insensitive). Useful for protecting `signs`, `op`, `ed` styles. |
| `applyIf` | predicate | no | Per-style applicability filter (see [`applyIf` comparators](#applyif-comparators)). When omitted, all non-ignored styles get the fields. |
| `when` | predicate | no | Aggregate-batch gate (rule-level, applies to whole batch). |

Common `[V4+ Styles]` fields you might write here: `Fontname`, `Fontsize`, `PrimaryColour`, `OutlineColour`, `BackColour`, `Bold`, `Italic`, `Underline`, `BorderStyle`, `Outline`, `Shadow`, `Alignment`, `MarginL`, `MarginR`, `MarginV`, `Encoding`.

---

## `when:` predicates

The `when:` block on any rule decides whether the rule **emits at all** based on aggregate metadata across all `.ass` files in the batch. If `when:` is omitted, the rule always fires.

### Predicate set

A `when:` block contains one or more **predicate clauses**. All clauses are ANDed (the rule fires only if all clauses are satisfied).

| Clause | Per-file logic | Aggregate logic |
|--------|----------------|-----------------|
| `anyScriptInfo` | matches all keys in `matches`, none in `excludes` | true if **at least one** file matches |
| `allScriptInfo` | same per-file logic | true if **every** file matches |
| `noneScriptInfo` | same per-file logic | true if **no** file matches |
| `notAllScriptInfo` | same per-file logic | true if **at least one** file does NOT match |
| `anyStyle` | matches per-style row | true if at least one style row matches |
| `allStyle` | matches per-style row | true if every style row matches |
| `noneStyle` | matches per-style row | true if no style row matches |

### `matches` and `excludes`

Each `*ScriptInfo`/`*Style` clause uses `matches` and/or `excludes` blocks to express per-file (or per-style) compound conditions:

```yaml
when:
  anyScriptInfo:
    matches:                         # ALL must equal (per file)
      "YCbCr Matrix": TV.601
    excludes:                        # NOT all of these together
      PlayResX: "640"
      PlayResY: "480"
```

Per-file semantics: "the file's `[Script Info]` has `YCbCr Matrix=TV.601`, AND the file is NOT (`PlayResX=640` AND `PlayResY=480`)." Aggregate (`anyScriptInfo`): true if at least one file in the batch satisfies that per-file predicate.

**Shorthand: bare keys are equivalent to `matches:` only.**

```yaml
when:
  anyScriptInfo:
    "YCbCr Matrix": TV.601
# is equivalent to:
when:
  anyScriptInfo:
    matches:
      "YCbCr Matrix": TV.601
```

So you only need the `matches:` / `excludes:` keywords when you actually want negation.

### Named predicates with `$ref`

Define reusable compound conditions in a top-level `predicates:` map; reference them with `$ref` inside `matches:` or `excludes:`.

```yaml
predicates:
  isSdDvd:
    "YCbCr Matrix": TV.601
    PlayResX: "640"
    PlayResY: "480"

rules:
  - type: setScriptInfo
    key: "YCbCr Matrix"
    value: "TV.709"
    when:
      anyScriptInfo:
        matches: { "YCbCr Matrix": TV.601 }
        excludes: { $ref: isSdDvd }
```

A predicate body is a flat key→value map of equality conditions (the same shape `matches`/`excludes` accept). Predicates can be referenced from `matches:`, `excludes:`, or both, in any rule.

---

## `applyIf` comparators

Only on `setStyleFields`. Decides which **styles** within an `.ass` file get the new fields. Distinct from `when:`, which decides whether the rule runs at all.

```yaml
- type: setStyleFields
  fields:
    MarginL: "200"
    MarginR: "200"
  applyIf:
    anyStyleMatches:
      MarginL: { lt: 50 }
```

Per-file semantics: "apply the `fields:` only if the file has at least one style row whose `MarginL` is less than 50." Files with no matching style row are left alone for this rule.

### Comparator vocabulary

| Comparator | Meaning |
|------------|---------|
| `eq: <number>` | strictly equal |
| `lt: <number>` | strictly less than |
| `gt: <number>` | strictly greater than |
| `lte: <number>` | less than or equal |
| `gte: <number>` | greater than or equal |

Style values are coerced to numbers before comparison (`Number(value)`); a non-numeric value never matches a comparator.

### Combining

```yaml
applyIf:
  anyStyleMatches:                  # at least one style row matches all
    MarginL: { lt: 50 }
    MarginR: { lt: 50 }
  excludesStyleMatches:             # AND no style row matches the negation set
    Name: "signs"                   # equality OK alongside comparators
```

`anyStyleMatches` / `allStyleMatches` / `noneStyleMatches` are the three aggregation modes. Each takes a per-style condition (mix of equality entries and `{ comparator: number }` entries).

---

## Computed values

Style field values can be computed from a metadata property via a structured math-ops list. **No expression language** — just an order-preserving array of `{ verb: number }` or bare-string operations applied to a numeric accumulator.

```yaml
- type: setStyleFields
  fields:
    MarginV:
      computeFrom:
        property: PlayResY        # source metadata property
        scope: scriptInfo         # scriptInfo OR style
        ops:
          - divide: 1080
          - multiply: 90
          - round
```

Per-file: read `scriptInfo.PlayResY` (or `style.PlayResY` if scope is `style`), coerce to number, apply each op left-to-right, write the final number as a string into the field.

### Op vocabulary

| Op shape | Meaning |
|----------|---------|
| `{ add: <n> }` | accumulator + n |
| `{ subtract: <n> }` | accumulator − n |
| `{ multiply: <n> }` | accumulator × n |
| `{ divide: <n> }` | accumulator / n (n must be ≠ 0) |
| `{ min: <n> }` | clamp upper: `Math.min(accumulator, n)` |
| `{ max: <n> }` | clamp lower: `Math.max(accumulator, n)` |
| `"round"` | `Math.round(accumulator)` (bare string, no operand) |
| `"floor"` | `Math.floor(accumulator)` |
| `"ceil"` | `Math.ceil(accumulator)` |
| `"abs"` | `Math.abs(accumulator)` |

**Out of scope (use a TS command instead):**

- Cross-property composition (e.g. multiplying two metadata values together).
- Conditional ops (`{ ifGt: 90 }`, etc.) — gate at the rule level via `when:` instead.
- Custom functions, regex transforms, string concatenation.

If a heuristic needs anything beyond this op vocabulary, write a TypeScript command like `computeDefaultSubtitleRules` and pipe the resolved rules in via `{ linkedTo, output }`.

---

## Examples

Real-world authoring patterns. Combine and adapt as needed.

### Example 1 — Always pin `ScriptType`

```yaml
rules:
  - type: setScriptInfo
    key: ScriptType
    value: "v4.00+"
```

The simplest possible rule. No `when:`, so it fires for every file.

### Example 2 — Force TV.709 except on SD-DVDs

The classic JS heuristic, fully expressed in the DSL:

```yaml
predicates:
  isSdDvd:
    "YCbCr Matrix": TV.601
    PlayResX: "640"
    PlayResY: "480"

rules:
  - type: setScriptInfo
    key: "YCbCr Matrix"
    value: "TV.709"
    when:
      anyScriptInfo:
        matches: { "YCbCr Matrix": TV.601 }
        excludes: { $ref: isSdDvd }
```

### Example 3 — Rescale 640×360 fansub releases to 1920×1080

```yaml
rules:
  - type: scaleResolution
    from: { width: 640, height: 360 }
    to: { width: 1920, height: 1080 }
    hasScaledBorderAndShadow: true
    when:
      anyScriptInfo:
        PlayResX: "640"
        PlayResY: "360"
```

The per-file `from:` guard skips files that aren't 640×360. The `when:` guard ensures the rule doesn't even emit unless the batch has at least one 640×360 file (so processing a 1080p-only batch doesn't pay the cost).

### Example 4 — MarginV computed from PlayResY

```yaml
rules:
  - type: setStyleFields
    fields:
      MarginV:
        computeFrom:
          property: PlayResY
          scope: scriptInfo
          ops:
            - divide: 1080
            - multiply: 90
            - round
    ignoredStyleNamesRegexString: "signs?|op|ed|opening|ending"
```

For a 1080p file, MarginV becomes `90`. For 720p, `60`. For 480p, `40`. Signs/songs styles are protected by the regex.

### Example 5 — Fix narrow margins ONLY when at least one style is too narrow

```yaml
rules:
  - type: setStyleFields
    fields:
      MarginL: "200"
      MarginR: "200"
    ignoredStyleNamesRegexString: "signs?|op|ed|opening|ending"
    applyIf:
      anyStyleMatches:
        MarginL: { lt: 50 }
```

Per-file: only files with a style row that has `MarginL < 50` get the fix; everyone else is left alone. The `ignoredStyleNamesRegexString` then ensures Sign/Song styles aren't overwritten when the rule does fire.

### Example 6 — All four heuristic branches together

A condensed port of `buildDefaultSubtitleModificationRules`:

```yaml
predicates:
  isSdDvd:
    "YCbCr Matrix": TV.601
    PlayResX: "640"
    PlayResY: "480"

rules:
  # Always pin ScriptType.
  - type: setScriptInfo
    key: ScriptType
    value: "v4.00+"

  # Force TV.709 except on SD-DVDs.
  - type: setScriptInfo
    key: "YCbCr Matrix"
    value: "TV.709"
    when:
      anyScriptInfo:
        matches: { "YCbCr Matrix": TV.601 }
        excludes: { $ref: isSdDvd }

  # Rescale fansub 640×360 to 1080p.
  - type: scaleResolution
    from: { width: 640, height: 360 }
    to: { width: 1920, height: 1080 }
    when:
      anyScriptInfo:
        PlayResX: "640"
        PlayResY: "360"

  # MarginV from PlayResY ratio. Protects signs/songs.
  - type: setStyleFields
    fields:
      MarginV:
        computeFrom:
          property: PlayResY
          scope: scriptInfo
          ops:
            - divide: 1080
            - multiply: 90
            - round
    ignoredStyleNamesRegexString: "signs?|op|ed|opening|ending"

  # Fix narrow MarginL/R only when needed.
  - type: setStyleFields
    fields:
      MarginL:
        computeFrom:
          property: PlayResX
          scope: scriptInfo
          ops:
            - divide: 1920
            - multiply: 200
            - round
      MarginR:
        computeFrom:
          property: PlayResX
          scope: scriptInfo
          ops:
            - divide: 1920
            - multiply: 200
            - round
    ignoredStyleNamesRegexString: "signs?|op|ed|opening|ending"
    applyIf:
      anyStyleMatches:
        MarginL: { lt: 50 }
```

### Example 7 — Force 1080p on a mixed-resolution batch

```yaml
rules:
  - type: setScriptInfo
    key: PlayResX
    value: "1920"

  - type: setScriptInfo
    key: PlayResY
    value: "1080"

  - type: setScriptInfo
    key: LayoutResX
    value: "1920"

  - type: setScriptInfo
    key: LayoutResY
    value: "1080"
```

No `when:` clauses; every file gets the same `[Script Info]` resolution stamp. Use only when you really know all your files should land at this resolution (e.g. consumer downstream expects 1080p source).

### Example 8 — Combining named predicates across rules

```yaml
predicates:
  isFansubRelease:
    "Encoded by": "fansub"
  isHd1080:
    PlayResX: "1920"
    PlayResY: "1080"
  isSd:
    PlayResX: "640"

rules:
  - type: setStyleFields
    fields:
      Fontname: "Arial"
    when:
      anyScriptInfo:
        matches: { $ref: isFansubRelease }
        excludes: { $ref: isHd1080 }

  - type: setStyleFields
    fields:
      Fontsize: "16"
    when:
      anyScriptInfo:
        matches: { $ref: isSd }
```

Two unrelated rules each reference the same named predicates. If you later edit `isHd1080` to require `LayoutResX: "1920"` too, both rules pick up the change.

---

## Validation cheatsheet

The Zod schemas live in `src/api/schemas.ts`. Naming convention:

| Top-level | `assModificationRulesSchema` (the array of rule objects) |
| Rule discriminator | `assModificationRuleSchema` (discriminated union on `type`) |
| Per-rule | `setScriptInfoRuleSchema`, `scaleResolutionRuleSchema`, `setStyleFieldsRuleSchema` |
| Predicates | `whenPredicateSchema`, `applyIfPredicateSchema`, `predicateBodySchema`, `comparatorSchema`, `computeFromSchema` |

A request to `modifySubtitleMetadata` validates against `modifySubtitleMetadataRequestSchema`, which carries `predicates` and `rules` at the top.

Validation failures are surfaced as Zod errors. Common gotchas:

- Numeric ASS fields are written as **strings**: `Fontsize: "16"`, NOT `Fontsize: 16`.
- Style/field names are case-sensitive (`MarginV`, not `marginV`).
- `from:` / `to:` widths and heights are numbers (`{ width: 1920, height: 1080 }`), not strings.
- Comparator operands in `applyIf` are numbers (`MarginL: { lt: 50 }`).
- `divide: 0` is rejected at validation time (no division by zero).
- `$ref` must point to a key that exists in the top-level `predicates:` map.

---

## When the DSL isn't enough

Reach for `computeDefaultSubtitleRules` (or write a sibling TS command) when:

- You need to combine multiple metadata properties in a single computed value (e.g. width × height ratio).
- You need conditional ops at the op level (e.g. "divide by 1080 only if PlayResY > 720").
- You need string transforms (regex, slicing, concatenation).
- You need to inspect file content beyond `[Script Info]` and `[V4+ Styles]` (e.g. read `[Events]` lines).
- The rule logic depends on something outside the `.ass` files themselves (e.g. external metadata, anime DB queries, user preferences).

The contract is the same in either case: the engine sees a fully-resolved `AssModificationRule[]` and can't tell whether they were typed by hand or computed. Pipe via `{ linkedTo: "computeRules", output: "rules" }` in the sequence.

See [subtitle-coverage.md](subtitle-coverage.md) for the design rationale behind this split.
