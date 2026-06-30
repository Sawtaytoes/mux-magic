# 2026-05-17 — `mergeTracks` renamed to `addSubtitles` (silent YAML shim)

- **Status:** Accepted
- **Date decided:** 2026-05-17
- **Area:** core / cli / web
- **Source:** commit `ea045525`

## Decision

The command was renamed `mergeTracks` → `addSubtitles` across server/CLI/web/docs, because it only muxes **subtitles** (plus optional chapters) — it never merges audio or general tracks. The old name is kept as a **silent** shim: `command: mergeTracks` is rewritten to `addSubtitles` at YAML load (via the `legacyFieldRenames` / renamed-command path), and the legacy route still resolves. No deprecation warning is shown.

## What we rejected — DO NOT revert to this

- Do not rename it back to `mergeTracks` thinking the name is "more general." The old name was actively misleading (it implied audio/general track merging); the rename corrected that on purpose.
- Do not add `mergeTracks` back to the command picker / typeahead — deprecated names load from legacy YAML but are not selectable for new steps. Same contract as the [Name Special Features rename](2026-05-14-name-special-features-rename-and-legacy-shim.md): load forever, don't offer it fresh.

## Why it must not be re-litigated

The name was wrong and was fixed; the silent shim preserves every existing template. Reverting the name re-introduces the audio-merge implication, and switching the shim to loud would break saved sequences that still say `mergeTracks`.
