# 2026-05-14 — Name Special Features command rename + legacy-name shim (loadable, not selectable)

- **Status:** Accepted (behavior verified in code 2026-06-30)
- **Date decided:** 2026-05-14 (rename); behavior clarified by the user 2026-06-30
- **Area:** core / web
- **Source:** worker 22, commit `b61a4067` (PR #109); user clarification 2026-06-30

## Decision

The command that was named `nameSpecialFeatures` was renamed to `nameSpecialFeaturesDvdCompareTmdb` — a verbatim, behavior-preserving rename. The longer name says what it uses (DVD Compare + TheMovieDB). The verbose name is intentional and stays.

Old saved YAML / shared sequences still say `command: nameSpecialFeatures`. The contract for that deprecated name has three parts:

1. **Loads via a silent shim.** The YAML codec transparently remaps `nameSpecialFeatures` → `nameSpecialFeaturesDvdCompareTmdb` on load (`RENAMED_COMMANDS` in `packages/web/src/jobs/yamlCodec.ts`). The step loads and renders in the UI with the current command's fields. A `console.warn` is fine; no thrown error.
2. **Not selectable in the command picker.** The deprecated name must NOT appear in the command search / autocomplete / typeahead dropdown when building a new step. The picker is populated from the current command list (`packages/web/src/commands/commands.ts`); the old name lives only in the remap map, so it is loadable from legacy YAML but cannot be picked fresh.
3. **Legacy direct route 404s.** `POST /commands/nameSpecialFeatures` is not registered (only current command names are).

## What we rejected — DO NOT revert to this

- **Do NOT make loading legacy YAML throw** for the old name. (An earlier version of this record wrongly claimed a "loud reject" was chosen — that is not the desired behavior.) Every saved sequence and shared URL that still references the old name must keep loading.
- **Do NOT add the deprecated name to the command picker / typeahead.** Deprecated means loadable, not selectable. It should never be an option a user can choose for a new step.
- **Do NOT shorten / merge** the long `nameSpecialFeaturesDvdCompareTmdb` name with its sibling commands. The verbose name keeps it legible next to the DVD-Compare/TheMovieDB variants.

## Why it must not be re-litigated

The shim protects every saved sequence and shared URL still on the old name — throwing would break them. Hiding the name from the picker keeps new work on the current command without offering a dead choice. This "load forever, but don't offer it" contract is the same one used for the `mergeTracks` → `addSubtitles` rename (see [that record](2026-05-17-mergetracks-renamed-addsubtitles.md)).

> Loose end (see handoff): `packages/web/src/components/GenericRunResults/GenericRunResults.tsx` still lists the bare legacy name `nameSpecialFeatures` — verify it's intentional and not a dead reference that should be the renamed command.
