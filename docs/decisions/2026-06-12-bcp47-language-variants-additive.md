# 2026-06-12 — BCP 47 language variants are additive; do NOT switch to 2-letter codes

- **Status:** Accepted
- **Date decided:** 2026-06-12
- **Area:** core
- **Source:** worker 3c, commit `d24c587f`; memory `project_bcp47_language_variants.md`

## Decision

ISO 639-2 three-letter codes (`chi`, `eng`, …) stay the **canonical** language key used for compare/filter. Regional/script variants are added via an **optional** `ietf` BCP 47 field on `LanguageSelection` (e.g. `{ code: "chi", ietf: "zh-Hant-HK" }`), emitted as `language-ietf=` to mkvpropedit/mkvmerge alongside the legacy `language=`. The three-letter `code` remains the matching key.

## What we rejected — DO NOT revert to this

Do not "just switch to two-letter codes" to support things like `zh-CN` or `pt-BR`. Both ISO 639-1 and 639-2 are **language-only** — regional variants require BCP 47 layered on top, so swapping the base system doesn't solve the problem and it **breaks** existing filters like `--audio-tracks chi,eng`. Also: ffmpeg is not a language boundary (it maps by index), so don't push language semantics into ffmpeg track selection.

## Why it must not be re-litigated

A future request for regional variants will strongly tempt an agent to replace the code system wholesale. That re-opens a solved design: variants are additive (`ietf` on top of the 3-letter canonical key), not a base-system swap.
