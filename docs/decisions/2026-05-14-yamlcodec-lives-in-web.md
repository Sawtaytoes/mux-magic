# 2026-05-14 — The YAML sequence codec lives in `web`, with a legacy-rename map

- **Status:** Accepted
- **Date decided:** 2026-05-14 (date captured in memory; the codec location is a longer-standing fact recorded here as a guard)
- **Area:** web
- **Source:** memory `reference_yaml_codec_location.md`; `packages/web/src/jobs/yamlCodec.ts`

## Decision

The YAML sequence codec is `packages/web/src/jobs/yamlCodec.ts` — it lives in the **web** package, not the server. Field renames are handled at read time by appending one line to its `legacyFieldRenames` map (shape: `{ command: { newName: oldName } }`) so old YAML and old `?seq=` / `?seqJson=` URLs keep loading.

## What we rejected — DO NOT revert to this

Do not move or duplicate the codec server-side on the assumption that "a codec/parser belongs on the server." The Builder owns sequence serialization; the server consumes already-resolved sequence bodies. Do not drop or bypass `legacyFieldRenames` when renaming a field — that map is the back-compat contract that keeps every saved template and shared URL loadable.

## Why it must not be re-litigated

Relocating the codec splits sequence-encoding logic across packages and breaks the single round-trip path that the Builder, copy-YAML, undo/redo, and URL-share all depend on. Field renames without a `legacyFieldRenames` entry silently break old templates on load.
