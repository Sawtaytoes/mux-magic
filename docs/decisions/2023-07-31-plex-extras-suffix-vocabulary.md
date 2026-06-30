# 2023-07-31 — Plex local-extras suffix tags are the canonical extra-type vocabulary

- **Status:** Accepted
- **Date decided:** 2023-07-31 (established at inception; refined through 2024)
- **Area:** dvdcompare / core
- **Source:** commit `be4e6a31` and the `parseSpecialFeatures.ts` lineage

## Decision

Parsed special-feature extras are normalized to **Plex's local-extras suffix set**: `-behindthescenes`, `-featurette`, `-deleted`, `-interview`, `-trailer`, `-short`, `-scene`, `-other` (plus `-teaser`), via a keyword→tag map. This vocabulary drives `parseSpecialFeatures.ts`, `editionTag.ts`, `findSiblingsForEdition.ts`, `rankCandidates.ts`, and `getSpecialFeatureFromTimecode.ts`. Specific mappings are deliberate, e.g. `documentary` → `featurette` (changed from `behindthescenes` in `7c05f125`), `clip` → `featurette`.

## What we rejected — DO NOT revert to this

- Do not rename or "rationalize" these suffixes to a custom/internal taxonomy. They are **Plex's** literal recognized suffixes — renaming them breaks Plex's automatic extra detection on the user's library.
- Do not flip `documentary` back to `behindthescenes`, and don't second-guess the established keyword→tag mappings without checking the lineage.

## Why it must not be re-litigated

The suffix strings are an external contract with Plex, not an internal naming choice. Changing them silently stops Plex from recognizing extras — a user-visible library regression with no error.
