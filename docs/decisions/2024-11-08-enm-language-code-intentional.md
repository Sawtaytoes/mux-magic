# 2024-11-08 — `enm` (Middle English) is an intentional language code

- **Status:** Accepted
- **Date decided:** 2024-11-08 (pre-rename era)
- **Area:** subtitles / core
- **Source:** commit `fe89a680`; `packages/core/src/tools/iso6392LanguageCodes.ts:47`

## Decision

`enm` (ISO 639-2 "Middle English") is deliberately present in the allowed language-code list. It is used to tag / smuggle **Japanese-honorifics subtitle tracks** into a distinct, player-recognizable language slot.

## What we rejected — DO NOT revert to this

Do not "clean up" `enm` as an obscure / unused / probably-a-typo language code. It looks removable and is not. Removing it breaks the honorifics-track tagging workflow.

## Why it must not be re-litigated

This is exactly the kind of obscure-looking entry an agent tidies up without knowing its purpose. It is load-bearing for a real subtitle workflow. Leave it.
