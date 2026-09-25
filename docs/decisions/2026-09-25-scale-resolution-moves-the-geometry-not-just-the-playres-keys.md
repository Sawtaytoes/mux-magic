# 2026-09-25 — scaleResolution moves the geometry, not just the PlayRes keys

- **Status:** Accepted
- **Date:** 2026-09-25
- **Type:** core
- **Supersedes:** —
- **Superseded by:** —
- **Source:** owner request in chat — *"We should probably add that functionality. I think I've run into it before too."* Completes [worker 62](../workers/62_scale-resolution-scales-style-fields.md), which had been `ready` since the revamp.

## Decision

`scaleResolution` scales the file's geometry onto the new canvas, not only the
`[Script Info]` keys. Two new options, both defaulting to **true**:

- `isScalingStyleGeometry` — style `Fontsize`, `Outline`, `Shadow`, `MarginV` by the
  height ratio; `MarginL`, `MarginR`, `Spacing` by the width ratio.
- `isScalingPositionTags` — `\pos`, `\org`, the first four arguments of `\move`, and the
  rectangular form of `\clip`/`\iclip`; plus `\fs`, `\bord`, `\shad`, `\ybord`, `\yshad`
  on the height ratio and `\fsp`, `\xbord`, `\xshad` on the width ratio.

`ignoredStyleNamesRegexString` protects style rows only. A sign's coordinates scale
regardless.

**x takes the width ratio and y takes the height ratio.** They are different numbers
whenever the aspect changes, so there is no single scale factor.

## Context

`applyScaleResolution` rewrote `PlayResX`, `PlayResY`, `LayoutResX/Y` and
`ScaledBorderAndShadow`, and nothing else. `docs/dsl/subtitle-rules.md` had claimed since
the revamp that it "proportionally rewrites every style's font sizes, margins, outline,
shadow", which was never true.

The failure is not subtle. Rescaling Heavy Metal L-Gaim OVA III from 640x480 to 1920x1080
moved all 13 positioned signs out of the shot — the title card landed in the upper-left
corner at a third of its size — and left all nine styles rendering at 1/2.25 scale.

## What we rejected — DO NOT revert to this

**Making these opt-in.** The old behavior is not a feature anybody chose; it is a file
that renders wrong, and the documentation already promised the new behavior. A flag
defaulting to `false` would have left every existing caller silently broken and put the
burden on whoever next rescaled a file with signs in it.

**Rounding every scaled field to an integer**, as worker 62 specified. Its own worked
example shows the cost: `Shadow: 1` at a 1/3 downscale becomes `Shadow: 0`, deleting the
shadow. ASS takes decimals for `Fontsize`, `Outline`, `Shadow` and `Spacing`, so only the
margins are rounded.

**Deferring the override tags again.** Worker 62 put them out of scope because "parsing
and rewriting them requires a structured ASS-text walker that doesn't exist". The subset
that carries coordinates is a bounded set of tags with numeric arguments, and a targeted
rewrite covers it without a general walker. A vector `\clip` and a `\p` drawing body still
need one, and those are still left alone.

## Why

A rule named `scaleResolution` that changes two numbers and leaves the file's geometry
behind produces a broken subtitle every time the source is not a single-style, sign-free
script. The defect had been documented as fixed for months, so the docs actively misled.

## Evidence

- Measured against libass, not assumed: `\pos(100,100)` at `Fontsize: 30` on a 640x480
  canvas renders **pixel-identically** to `\pos(300,225)` at `Fontsize: 68` on a
  1920x1080 canvas — identical bounding boxes, `x 288-311, y 215-243`. So x scales by
  1920/640 = 3.00 and y by 1080/480 = 2.25, while glyphs scale by the height ratio alone.
- A glyph-run width measurement confirms there is no horizontal stretch: the same string
  at the same nominal size measures 364 x 38 px on a 640x480 canvas and 162 x 17 px on a
  1920x1080 one — ratios 2.247 and 2.235, both the height ratio.
- Real file, 713 cues, nine styles, 13 `\pos` signs. Rendered from the MKV before and
  after: with the scaling the nameplates sit under the Japanese text; without it, the
  title card renders top-left at a third size and the songs at half size. Frame-difference
  against the unscaled rescale: 4.265% of the frame on the title card, 3.726% on the song
  pair, 1.752% on the credits.
- 34 unit tests in `packages/core/src/tools/assFileTools.test.ts`, including the trailing
  `\move` times, a vector `\clip`, a `from:` guard miss, and a same-resolution no-op.
