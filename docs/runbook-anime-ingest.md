# Runbook — ingesting anime episodes with mux-magic

The basic flow for normalizing an anime release into the Plex library: name episodes
from AniDB, trim to the audio + subtitle languages you keep, apply the default subtitle
rules, re-mux, and move into the library. Concrete sequence:
[`examples/ingest-anime-episodes.yaml`](../examples/ingest-anime-episodes.yaml).

This is the **most basic** ingest — it only "pushes up" the subtitles. Some releases also
need an audio or subtitle **track swap** from a different source (better audio, songs,
alternate subs); see [Variations](#variations). Run everything from the Sequence Builder:
<https://mux-magic.octen.dev> → **Load YAML** → **Run on Server**.

## Before you start

- **Work on copies.** Process in a `work/` folder; keep pristine originals elsewhere so a
  bad run costs nothing. Delete `work/` once you've verified the library files.
- **Container paths, not on-disk paths.** In the mux-magic container the media root is
  `/media/…`, e.g. on-disk `/mnt/Bunnies/Family/Downloads/…` (Windows `G:\Downloads\…`) is
  `/media/Downloads/…`. All paths in the YAML are the `/media/…` form.
- **Typed `variables:` block.** The Sequence Builder uses `variables:` (not `paths:`),
  each with a `type` — `type: path` for directories, `type: anidbId` for the AniDB aid.
  Reference them as `@name`.
- **Existing library is the naming authority.** Proposed names must match the show already
  in Plex — same season/episode scheme, same title punctuation. Don't invent a convention.

## The sequence, step by step

| # | Command | Why |
| --- | --- | --- |
| 1 | `nameAnimeEpisodesAniDB` | Names episodes from AniDB metadata → `<Series> - sNNeNN - <title>`. |
| 2 | `keepLanguages` | Drop all but the audio/sub languages you keep (e.g. `jpn` audio + `eng` subs). Fonts are retained. |
| 3 | `flattenOutput` | Move the trimmed output back onto `workDir`. **Instant move**, not a copy. |
| 4 | `extractSubtitles` → `deleteFilesByExtension` | Pull the `.ass` out; prune non-`.ass`. |
| 5 | `modifySubtitleMetadata` (`hasDefaultRules: true`) | Default rules: ScriptType, TV.709, margin fixes, MarginV/vheight. |
| 6 | `addSubtitles` | Re-mux the modified subs back in (drops the stale embedded sub, keeps video/audio/fonts). |
| 7 | `moveFiles` | Move the finished files into the Plex library folder. |

### Gotchas (these bit us — bake them in)

- **Use `flattenOutput`, not `copyFiles`, to bring a step's output folder back.**
  `copyFiles` fails with *"Refusing to overwrite existing destination"* when the target
  name already exists in `workDir`. `flattenOutput` (with `deleteSourceFolder: true`) does
  an instant move and safely catches the chmod/rename error, so it completes.
- **`extractSubtitles` is the current command; `copyOutSubtitles` is deprecated.**
- **Don't add an explicit `MarginV` rule.** The vheight bump (MarginV → 90 at 1080p, signs
  & songs protected) is already part of `hasDefaultRules`. Adding it is redundant.
- **`modifySubtitleMetadata` works on `.ass` files on disk, not tracks inside an MKV** —
  hence the `extractSubtitles` → modify → `addSubtitles` round-trip. ASS only.
- **Naming a partial or out-of-order set.** By default `nameAnimeEpisodesAniDB` index-pairs
  files to AniDB episodes starting at episode 1 (after a natural sort), so a partial set
  (say E05–E12) would misnumber as `s01e01…`. Two options:
  1. `filenameRegex: 'S\d+E(?<episodeNumber>\d+)'` — pair each file to the episode number
     captured from its name. Handles partial, non-contiguous, and out-of-order sets, and
     is what your incoming files (`… S02E05 …`) already support.
  2. `startEpisodeNumber: 5` — begin index pairing at episode 5 for a contiguous set.
  `regular`/`others` also warn on a >2 min file/episode duration mismatch — heed that as a
  mis-pairing signal.

## Variations

The basic flow above only pushes up subtitles. When a release needs more:

- **Audio-track swap (e.g. a higher-quality or different-source audio).** Add a
  `replaceTracks` step against a donor folder, keeping the target's video + subs:
  ```yaml
  - id: swapAudio
    command: replaceTracks
    params:
      sourceFilesPath: '@donorDir'      # donor audio source (filenames matched)
      destinationFilesPath: '@workDir'  # keeps video + subs
      audioLanguages: [jpn]             # pull this language's audio from the donor
      hasAudioSyncOffset: true          # AUTO cross-correlation alignment (audio-offset-finder)
  ```
  `hasAudioSyncOffset: true` extracts both audios to WAV and runs `audio-offset-finder`
  (FFT cross-correlation) per file, applying the detected offset as `--sync -1:<ms>` — real
  detection, not a fixed delay. **`replaceTracks` pairs files by identical filename**
  across the two folders (no SxxExx/fuzzy match), so align donor filenames first.
- **Subtitle-track swap / add songs.** Extract the desired `.ass` from the donor,
  `modifySubtitleMetadata`, and `addSubtitles` it in — same round-trip as above.

## Requirements

- Auto audio-alignment needs `audio-offset-finder` + `ffmpeg` on the mux-magic host
  (bundled in its Docker image).
- AniDB naming caches the manami anime-offline-database (~60 MB, 7-day cache) and per-anime
  XML from `api.anidb.net:9001`.
