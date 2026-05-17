# CLI

Run any command through the `yarn media` script:

```sh
yarn media <command> [options]
yarn media --help                  # list all commands
yarn media <command> --help        # options for a specific command
```

---

## Commands

| Command | Syntax | Description |
|---|---|---|
| `changeTrackLanguages` | `<sourcePath>` | Change the language tag on video, audio, or subtitle tracks. Useful when tracks were mislabelled (e.g. English subs marked as Japanese). |
| `copyFiles` | `<sourcePath> <destinationPath>` | Copy all files from one directory into another. Does not recurse. Handy for moving processed files (e.g. from a `LANGUAGE-TRIMMED` output dir) back to the original. |
| `extractSubtitles` | `<sourcePath>` | Extract subtitle tracks into separate files alongside each video file. |
| `copyOutSubtitles` | `<sourcePath>` | **Deprecated** — alias for `extractSubtitles`. Will be removed in a future release. |
| `fixIncorrectDefaultTracks` | `<sourcePath>` | Set the first track of each type (video/audio/subs) as the default and unset all others. |
| `getAudioOffsets` | `<sourceFilesPath> <destinationFilesPath>` | Print the audio offset between matching files in two directories. |
| `hasBetterAudio` | `<sourcePath>` | List files where a higher channel-count audio track is not first. |
| `hasBetterVersion` | `<sourcePath>` | List Ultra HD Blu-ray releases where a better version exists (sourced from criterionforum.org). |
| `hasDuplicateMusicFiles` | `<sourcePath>` | List directories containing duplicate music files (same name, different format, or `(2)`/` - Copy` copies). |
| `hasImaxEnhancedAudio` | `<sourcePath>` | List files that contain an IMAX Enhanced audio track. |
| `hasManyAudioTracks` | `<sourcePath>` | List files with more than one audio track. |
| `hasSurroundSound` | `<sourcePath>` | List files with audio channel counts above 2. |
| `hasWrongDefaultTrack` | `<sourcePath>` | List files where the default audio or subtitle track is not the first track. |
| `inverseTelecineDiscRips` | `<sourcePath>` | Re-encode the video track to convert 60i disc rips back to 24p (IVTC). SDR, 8-bit, native 24fps sources only. |
| `isMissingSubtitles` | `<sourcePath>` | List files and folders that have no subtitle tracks. |
| `keepLanguages` | `<sourcePath>` | Remove all audio and subtitle tracks except the specified ISO 639-2 languages. |
| `mergeOrderedChapters` | `<sourcePath> [introFilename] [outroFilename]` | Merge files that use ordered chapters with a shared intro/outro into self-contained files. Requires PCM audio (convert FLAC first). |
| `addSubtitles` | `<subtitlesPath> <sourcePath> [offsets...]` | Mux subtitle tracks (and optionally chapters) from a matching directory into media files. |
| `mergeTracks` | `<subtitlesPath> <sourcePath> [offsets...]` | (DEPRECATED — alias of `addSubtitles`) Same behavior; emits a deprecation warning. |
| `moveFiles` | `<sourcePath> <destinationPath>` | Copy all files to a destination then delete the source directory. Equivalent to `copyFiles` + delete. |
| `nameAnimeEpisodes` | `<sourcePath> <searchTerm>` | Rename anime episode files using MyAnimeList metadata. |
| `nameAnimeEpisodesAniDB` | `<sourcePath> <searchTerm>` | Rename episode files using titles from AniDB. Better OVA/special coverage than MAL. See [AniDB command notes](#anidb-command-notes). |
| `nameSpecialFeaturesDvdCompareTmdb` | `<sourcePath> <url>` | Rename disc special features using timecodes from a dvdcompare.net URL; movie title canonicalized via TMDB. Renamed from `nameSpecialFeatures` in worker 22 to stay legible alongside upcoming sibling commands. |
| `nameTvShowEpisodes` | `<sourcePath> <searchTerm>` | Rename episode files using titles from TVDB. |
| `renameDemos` | `<sourcePath>` | Rename demo files to the standard format (see [Demo file format](#demo-file-format)). |
| `renameMovieClipDownloads` | `<sourcePath>` | Rename TomSawyer AVSForums movie clips to the demo format. |
| `reorderTracks` | `<sourcePath>` | Reorder video, audio, or subtitle tracks by index. |
| `replaceAttachments` | `<sourceFilesPath> <destinationFilesPath>` | Copy font/attachment files from source MKVs into matching destination MKVs. |
| `replaceFlacWithPcmAudio` | `<sourcePath>` | Convert FLAC audio tracks to PCM at the same bit depth. |
| `replaceTracks` | `<sourceFilesPath> <destinationFilesPath> [offsets...]` | Replace audio, subtitle, or chapter tracks in destination files with tracks from matching source files. |
| `setDisplayWidth` | `<sourcePath>` | Override the display width (DAR) of video files. Useful for correcting 4:3 vs 16:9 on anamorphic DVD rips. |
| `splitChapters` | `<sourcePath> <chapterSplits...>` | Split a large file into separate files at given chapter boundaries. Useful for disc rips that contain multiple episodes. |
| `storeAspectRatioData` | `<sourcePath> [folders...]` | Scan media files and write their internal crop/aspect ratio data to a JSON file. |

---

## Common options

Most commands support:

| Option | Alias | Description |
|---|---|---|
| `--recursive` | `-r` | Recurse into subdirectories. |
| `--recursiveDepth N` | `-d N` | Limit recursion to N levels deep (use with `-r`). |

Language options accept [ISO 639-2](https://en.wikipedia.org/wiki/List_of_ISO_639-2_codes) three-letter codes (e.g. `eng`, `jpn`, `fra`).

---

## AniDB command notes

`nameAnimeEpisodesAniDB` is a parallel implementation to `nameAnimeEpisodes` that uses AniDB instead of MAL. AniDB has better coverage of OVAs and specials.

**Search backend.** anidb.net is behind a Cloudflare interactive challenge and the HTTP API has no name-search endpoint. Search uses the [manami-project anime-offline-database](https://github.com/manami-project/anime-offline-database), a community-maintained JSON dataset that cross-references AniDB / MAL / AniList / Kitsu IDs. The dataset is downloaded once (~60 MB) and cached for 7 days under `<ANIDB_CACHE_FOLDER>/manami/` (defaults to `./.cache/anidb/manami/`). Refreshes do a HEAD-redirect version check first and skip the download when the upstream version slug matches what's on disk.

**Lookup backend.** Once you have an aid, episode metadata is fetched from `api.anidb.net:9001` (the AniDB HTTP API, which is on a separate host that bypasses Cloudflare). Per-anime XML is cached for 7 days under `<ANIDB_CACHE_FOLDER>/anime/<aid>.xml`.

**Cache location.** Set `ANIDB_CACHE_FOLDER` in `.env` (or your container env) to point both caches at a directory that survives restarts — important in Docker where the project-relative `./.cache/anidb/` is ephemeral.

**Episode types (`episodeType` param).** Six modes — one per AniDB episode-type code — so users can run each subset separately rather than mixing them in one prompt loop:

- `regular` (default) — type=1. Files map to episodes index-for-index after natural sort. Each pair also reads the file's mediainfo duration and logs a `DURATION MISMATCH` warning when the file/episode lengths diverge by more than 2 minutes (the rename still applies — the warning is advisory). Output: `<seriesName> - sNNeNN - <episodeTitle>` using AniDB's epno verbatim.
- `specials` — type=2 (S). Per-file picker (see below). Output: `<seriesName> - s00eNN - <episodeTitle>`.
- `credits` — type=3 (C, OP/ED songs). Per-file picker. Output: `<seriesName> - s00eNN - <episodeTitle>`.
- `trailers` — type=4 (T, PVs/promos). Per-file picker. Output: `<seriesName> - s00eNN - <episodeTitle>`.
- `parodies` — type=5 (P). Per-file picker. Output: `<seriesName> - s00eNN - <episodeTitle>`.
- `others` — type=6 (O, director's-cut alternates). Same index-paired flow as `regular`, with the same duration sanity-check warning. Output: `<seriesName> - sNNeNN - <episodeTitle>` using `seasonNumber` and a sequential index.

**Per-file picker (specials / credits / trailers / parodies).** Each file's mediainfo duration is matched against AniDB's rough minute-length estimates; the picker surfaces the top length-ranked candidates plus skip and cancel options, and already-claimed entries drop out of subsequent prompts. Keys in the builder modal: `0`–`9` pick a candidate, **Space** skips the current file, **Esc** cancels the loop and applies any matches confirmed so far.

**Complete vs Parts pre-prompt.** When AniDB's filtered list contains both a "complete" entry and "Part N" entries for the same content (common for OVAs and movies with multi-part rips), the rename surfaces a one-time prompt asking which form your files match. The chosen subset feeds into the normal pairing — index-paired for `regular`/`others`, picker for the rest.

In the CLI, the picker prompts hit your terminal one file at a time. In the API/builder, the same prompts ride the existing job-event channel — answer them in the job log surface as the job runs.

**Planned features (not yet implemented).**

- **Episode range/list filter.** Name only a subset of files — e.g., `episodes: "1-4"` or `"5,7,10"`. Useful when you've already named some episodes and got the rest later.

---

## Demo file format

`renameDemos` and related commands produce filenames following this pattern:

```
<Title> (<Year>) [<Scene>] {<Resolution> [<AspectRatio>] <DynamicRange> & <AudioFormat>}
```

Examples:

- `Ford v Ferrari (2019) [Broken Brakes] {4K HDR10 & Dolby Atmos TrueHD}`
- `Pink Floyd - The Dark Side Of The Moon - Any Colour You Like {FHD SDR & Dolby Atmos TrueHD}`
- `[Dolby] Argon {SD SDR & Dolby Digital 5.1}`

---

## Build a standalone Windows executable

```sh
yarn cli-app:sea
```

Output: `dist/mux-magic.exe`
