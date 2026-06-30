# 2026-06-29 — Decisions-vs-implementation audit

Checked every record in [docs/decisions/](../decisions/) against the actual code on `feat/mux-magic-revamp`, to catch decisions that are *documented but not implemented* ("sketchy compared to the decisions docs").

## Bottom line

**The codebase honors essentially every code-checkable decision.** The user's worry that decisions drifted from reality is largely unfounded — with **two** exceptions worth action:

### 1. `flattenOutput` does copy+delete instead of a move — VIOLATION (fix filed)

`flattenOutput` (delete-originals path) byte-copies via `aclSafeCopyFile` + `rm -r` instead of `fs.rename`, despite flattening to the same volume. Violates [atomic-copy-and-filesystem-move](../decisions/2026-05-19-atomic-copy-and-filesystem-move.md). **Filed as worker 7d** ([docs/workers/7d_filesystem-move-not-copy-delete.md](../workers/7d_filesystem-move-not-copy-delete.md)). `moveFiles`, `moveFilesIntoNamedFolders`, `flattenChildFolders`, and the Name Special Features bucket moves are all correct (pure `fs.rename`).

### 2. Name Special Features legacy-name rejection: doc said "loud", code is "silent" — RESOLVED 2026-06-30

The decision record previously claimed loading YAML with the legacy `nameSpecialFeatures` name should fail *loudly*. The code does a **silent shim** instead (`RENAMED_COMMANDS` in `yamlCodec.ts`, transparent remap + console.warn; legacy route 404s; name absent from the command picker). The user confirmed 2026-06-30 that the silent shim **is** the desired behavior — legacy YAML must keep loading and render in the UI, but the deprecated name must not be selectable in the command search/typeahead. The code already matches this. The record was rewritten to reflect reality: [name-special-features-rename-and-legacy-shim](../decisions/2026-05-14-name-special-features-rename-and-legacy-shim.md). One loose end → handoff: `GenericRunResults.tsx` still lists the bare legacy name.

## HONORED — verified in code (spot-check evidence)

| Decision | Evidence |
|---|---|
| NSF filesystem-is-state | `buckets.ts` two buckets, lazy mkdir, re-run guard, no JSON sidecar; SmartMatch Apply = single `/files/rename` |
| Smart Match scoring server-side | scorer in `rankCandidates.ts`; no client `smartMatchScoring.ts` |
| Single-process front-door | `WEB_PORT` gone; no `__API_BASE__` injection; `index.html` never mutated |
| Container detection positive signal | `versionRoutes.ts` checks `IS_CONTAINERIZED` + `/proc/1/cgroup`; no `.dockerenv` |
| Remove HA endpoint | no `sync-mux-magic`/`HA_TRIGGER_TOKEN`/`X-HA-Token`; outbound webhook kept |
| convertLosslessToFlac rejects video | `filterIsLosslessAudioFile.ts` audio-only allowlist; float/DSD short-circuit; tests present |
| Five wiring surfaces | recent commands all present in `commands.ts` |
| Resolve step links in React | `PathField.tsx` uses `getLinkedValue` then params fallback |
| sourcePath canonical | legacy names only as `legacyFieldRenames` values; `deleteCopiedOriginals.pathsToDelete` exception intact |
| zod/mini blocked | route files import `"zod"`, not `zod/mini` |
| BCP47 additive | optional `ietf` emitted as `language-ietf=`; 3-letter `code` canonical |
| mergeTracks→addSubtitles | silent shim in `yamlCodec.ts`; route 404s |
| Per-file pipelining Shape 2 | no `forEachFiles`; rxjs Observables; stream-breakers `toArray()`. (Note: `wrapAsSourcePath` symbol not found by name — logic folded into `resolveSequenceParams`/`getFilesAtDepth`; design holds) |
| copyFiles generalized | no `copyAnime`/`copyManga`; regex-knob driven |
| pure≠no-mutation | stateful skip-list modules intact as singletons |
| test() not it(); no return types | no `it(` calls; ESLint rule configured |
| rebrand, yamlCodec-in-web, AGENTS.md-slim | all confirmed |

## Not code-checkable (process/workflow decisions)

PR-base-branch, auto-merge, architecture-recommendation, e2e-trust-gate, worker-session-protocol — human workflow rules with no code surface. All consistent with current repo state.
