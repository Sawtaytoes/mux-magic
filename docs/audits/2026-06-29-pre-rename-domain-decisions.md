# 2026-06-29 — Pre-rename (2023–2024) domain decisions dig

The codebase predates Claude: first commit **2023-07-19** (the original DVDCompare special-features tool, before the `media-tools` → `mux-magic` rename). This is the mined set of load-bearing design decisions from that era that current `packages/core` still relies on. The most reversal-prone ones were promoted to standalone decision records; the rest are preserved here so the dig isn't lost.

## Promoted to decision records

- [Mux with mkvmerge, not ffmpeg](../decisions/2023-10-22-mux-with-mkvmerge-not-ffmpeg.md) (2023-10-22, `aa9841e9`)
- [Probe media with MediaInfo, not ffprobe](../decisions/2023-07-29-probe-media-with-mediainfo-not-ffprobe.md) (2023-07-29, `a63adf89`)
- [RxJS Observable pipeline backbone](../decisions/2023-07-19-rxjs-observable-pipeline-backbone.md) (2023-07-19, `984a62d2`)
- [`enm` language code is intentional](../decisions/2024-11-08-enm-language-code-intentional.md) (2024-11-08, `fe89a680`)
- [Plex extras suffix vocabulary](../decisions/2023-07-31-plex-extras-suffix-vocabulary.md) (2023-07-31, `be4e6a31`)
- [Track ops write to a new output folder](../decisions/2023-10-21-track-ops-write-to-new-output-folder.md) (2023-10-21, `9d557953`)

## Preserved here (lower reversal risk; promote to a record if one gets violated)

| Decision | Date | Commit | Don't-revert note |
|---|---|---|---|
| **DVDCompare scraping is `fetch` + HTML parse, NOT a headless browser** | rewrite post-2023 | (orig `984a62d2`/`cf0b5237` used Puppeteer; `7ee4c711` deleted an even earlier `scrapeDvdCompare.ts`) | `searchDvdCompare.ts` uses plain `fetch` against `dvdcompare.net` `search.php`/`film.php`. Do NOT reintroduce Puppeteer/headless-browser scraping — it was deliberately removed. The release-by-hash selection survived; Puppeteer did not. |
| **DVDCompare release chosen by URL `#hash`, defaulting to `"1"`** | 2024-09-12 | `b7c226bf` | Tests assert `{ hash: "1", label }`; `searchDvdCompare.ts` types `hash: string`. Keep the `|| "1"` empty-hash fallback. |
| **Special-feature timecode ranges are user-configurable** | 2025-04-05 | `a23c9b16` | Tolerance was made configurable (was hard-coded). Lives in `getSpecialFeatureFromTimecode.ts` / `nameSpecialFeaturesDvdCompareTmdb.timecode.ts`. Don't re-hard-code it. |
| **Timecodes parsed from trailing parentheticals even with resolution prefix** (`(1080p, 55:00)`) | 2023-07 | `7aadc806`, `c207e22d` | Regex `\(.+?(\d+:\d+)\)` (not bare `\((\d+:\d+)\)`); duration→timecode uses Date math to avoid the `1:60` overflow. Don't narrow the regex or hand-roll the minute math. |
| **Filesystem-illegal title chars → ` - `** | 2023-07-25 | `d678ca60`, `dd6a576d` | `:`, `/`, `?` replaced with ` - ` (runs collapsed) in `parseSpecialFeatures.ts`. Cross-platform-safe filenames; don't change the replacement style. |
| **Duplicate source filenames allowed; outputs named distinctly** | 2023-07-31 | `866ac8bb` | Evolved into `editionTag.ts` / `findSiblingsForEdition.ts` / `reorderRenamesForOnDiskConflicts.ts`. Don't reimpose one-file-per-name. |
| **"Better audio" = default 2 channels, triggers at >2 audio tracks (excl. Dolby Surround)** | 2023-08-24 | `bce36c33`, `bdc12178`, `fee6851c` | Heuristics in `hasBetterAudio.ts` / `audioHelpers.ts`. Don't revert the threshold to >1 or re-add Dolby Surround to the "better" set. |
| **`*MkvMerge` module-naming suffix** (CLI tool, not GUI) | 2024-02-07 | `57c759c7` | Modules calling the mkvmerge CLI are suffixed `MkvMerge`, not `MkvToolNix`. Keep the convention. |
| **Container runs as non-root `apps` user** | 2025-04-07 | `20d34e41` | The Dockerfile was rewritten multi-stage in the Claude era but descends from this; the non-root intent + mkvtoolnix-from-official-Debian-repo install persist. Don't assume the Dockerfile is AI-greenfield. |

> If any of these gets violated or re-litigated, promote it to a full `docs/decisions/` record (with a "What we rejected" section) rather than re-deriving it.
