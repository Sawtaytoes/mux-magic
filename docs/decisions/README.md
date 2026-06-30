# Decision Log

An **append-only** record of settled decisions for this codebase — especially the ones a human explicitly corrected ("no, that's wrong — do it this way"). Its job is to stop the nightly cycle of an agent silently reverting a choice that was already made and paid for.

If you are an agent: skim this index at the start of any non-trivial task. Before redesigning a feature, deleting something that looks unused, "simplifying" an API shape, or renaming something — **check whether a decision already covers it.** If one does, follow it. See [AGENTS.md](../../AGENTS.md) for the standing rule.

## How this log works

- **One decision per file**, named `YYYY-MM-DD-kebab-slug.md`. The date is **when the decision was made** (commit / PR / chat date), not when the file was written — so the log reads as a timeline and you can see when we changed our minds.
- Every file has a **"What we rejected — DO NOT revert to this"** section. That is the load-bearing part: it names the approach you must not drift back toward.
- **Append-only.** We never delete or rewrite a decision. New information becomes a new file.
- **Supersession, never deletion.** When a later decision overrides an earlier one:
  - The old file stays. Its `Status` becomes `Superseded by [link]` and a `> [!WARNING]` callout goes at the top pointing forward ("this used to be the decision, now it's X").
  - The new file carries a `Supersedes: [link]` line back to the old one.
  - This two-way trail is the whole point: an agent that lands on the stale decision is routed to the current one instead of re-implementing the old thing.
- Start a new file from [TEMPLATE.md](TEMPLATE.md).

## Index (newest first)

| Date decided | Decision | Area | Status |
| --- | --- | --- | --- |
| 2026-06-30 | [A special feature is never auto-named without a Plex `-<type>` suffix](2026-06-30-special-features-always-get-plex-type-suffix.md) | core / web | Accepted |
| 2026-06-29 | [The CI/lint-enforced conventions are locked too](2026-06-29-enforced-conventions-are-also-locked.md) | process | Accepted |
| 2026-06-12 | [zod/mini migration is BLOCKED — do not retry](2026-06-12-zod-mini-migration-blocked.md) | server/api | Accepted |
| 2026-06-12 | [Container detection uses a positive signal, not `/.dockerenv`](2026-06-12-container-detection-positive-signal.md) | server/api | Accepted |
| 2026-06-12 | [`test()` not `it()`; no redundant arrow return types](2026-06-12-test-not-it-and-no-return-types.md) | process | Accepted |
| 2026-06-12 | [BCP 47 language variants are additive; don't switch to 2-letter codes](2026-06-12-bcp47-language-variants-additive.md) | core | Accepted |
| 2026-05-19 | [Atomic copy + filesystem move (FICLONE, ZFS-EPERM, no temp on same-volume moves)](2026-05-19-atomic-copy-and-filesystem-move.md) | core / tools | Accepted |
| 2026-05-19 | [NSF state lives in the filesystem, not a JSON cache](2026-05-19-nsf-filesystem-is-the-state.md) | core / web | Accepted |
| 2026-05-19 | [Smart Match scoring runs server-side; no client scorer](2026-05-19-smartmatch-scoring-server-side.md) | core / web | Accepted |
| 2026-05-19 | [`convertLosslessToFlac` rejects video containers](2026-05-19-convertlosslesstoflac-rejects-video.md) | core | Accepted |
| 2026-05-19 | [React components must resolve step links, not just `params`](2026-05-19-resolve-step-links-in-react.md) | web | Accepted |
| 2026-05-18 | [Single-process front-door; no WEB_PORT; never mutate index.html](2026-05-18-single-process-front-door.md) | infra | Accepted |
| 2026-05-17 | [Remove HA-specific endpoint; keep generic outbound webhooks](2026-05-17-remove-ha-specific-endpoint.md) | server/api | Accepted |
| 2026-05-17 | [`mergeTracks` renamed to `addSubtitles` (silent shim)](2026-05-17-mergetracks-renamed-addsubtitles.md) | core | Accepted |
| 2026-05-16 | ["Pure functions" means remove mutation, NOT extract env reads](2026-05-16-pure-means-no-mutation.md) | core / process | Accepted |
| 2026-05-16 | [Per-file pipelining is Shape 2 (rxjs operator); no `forEachFiles`](2026-05-16-per-file-pipelining-shape-2.md) | core | Accepted |
| 2026-05-15 | [e2e failures are real; don't dismiss them as flaky](2026-05-15-e2e-is-the-trust-gate.md) | process | Accepted |
| 2026-05-14 | [Name Special Features rename + legacy-name shim (loadable, not selectable)](2026-05-14-name-special-features-rename-and-legacy-shim.md) | core / web | Accepted |
| 2026-05-14 | [A new command must land on all of its wiring surfaces](2026-05-14-new-command-needs-five-wiring-surfaces.md) | web / process | Accepted |
| 2026-05-14 | [`copyFiles`/`moveFiles` generalized; no per-media-type commands](2026-05-14-copyfiles-generalized-no-media-type-commands.md) | core | Accepted |
| 2026-05-14 | [The YAML sequence codec lives in `web`, with a legacy-rename map](2026-05-14-yamlcodec-lives-in-web.md) | web | Accepted |
| 2026-05-13 | [Rebrand: media-tools → mux-magic; `@media-tools` retired](2026-05-13-rebrand-media-tools-to-mux-magic.md) | naming | Accepted |
| 2026-05-13 | [Worker PRs target `feat/mux-magic-revamp`, not `master`](2026-05-13-pr-base-branch-is-feat-branch.md) | process | Accepted |
| 2026-05-13 | [HA inbound trigger endpoint](2026-05-13-ha-inbound-trigger-endpoint.md) | server/api | **Superseded** |
| 2026-05-12 | [`sourcePath` is the canonical primary-input field name](2026-05-12-sourcepath-canonical-field-name.md) | core | Accepted |
| 2026-05-08 | [Auto-merge PRs when tests + self-check pass](2026-05-08-auto-merge-passing-prs.md) | process | Accepted |
| 2026-05-07 | [Worker session protocol: worktree, push-as-you-go, flip your own row](2026-05-07-worker-session-protocol.md) | process | Accepted |
| 2026-05-07 | ["Update AGENTS.md" means the reference docs; keep the index slim](2026-05-07-update-agents-md-means-reference-docs.md) | process | Accepted |
| 2026-05-07 | [Architecture choices: one stable recommendation; minimize npm deps](2026-05-07-architecture-recommendation-and-minimize-deps.md) | process | Accepted |
| 2024-11-08 | [`enm` (Middle English) is an intentional language code](2024-11-08-enm-language-code-intentional.md) | subtitles | Accepted |
| 2023-10-22 | [Mux/merge tracks with mkvmerge, not ffmpeg](2023-10-22-mux-with-mkvmerge-not-ffmpeg.md) | core | Accepted |
| 2023-10-21 | [Track operations write to a new output folder, never overwrite originals](2023-10-21-track-ops-write-to-new-output-folder.md) | core | Accepted |
| 2023-07-31 | [Plex local-extras suffix tags are the canonical extra-type vocabulary](2023-07-31-plex-extras-suffix-vocabulary.md) | core | Accepted |
| 2023-07-29 | [Probe media with the MediaInfo CLI, not ffprobe](2023-07-29-probe-media-with-mediainfo-not-ffprobe.md) | core | Accepted |
| 2023-07-19 | [The pipeline is built on RxJS Observables](2023-07-19-rxjs-observable-pipeline-backbone.md) | core | Accepted |

> **Dates** are when each decision was *made*, recovered from git committer dates, PR merge dates, and Claude memory-capture dates — not when this file was written. Commit-backed dates are exact; standing-convention dates marked "captured in memory" are a floor (the decision may be slightly older). **Timeline note:** the codebase dates to **2023-07-19** (the original DVDCompare special-features tool, pre-rename); the 2023–2024 records above are pre-Claude decisions recovered from git history. Claude collaboration began around **2026-05-05** (the `media-tools` era) — there is no Claude history from March/April 2026. Related audits live in [docs/audits/](../audits/) (v1.0.0 parity delta, decisions-vs-implementation, pre-rename domain dig). If you make a decision that isn't here, add it from [TEMPLATE.md](TEMPLATE.md).
