# Runbook — combining two releases into one file (video from A, subs from B)

**Goal:** you have the same title in two releases and want to cherry-pick tracks
from each into one output — e.g. keep the **video + one audio language** from the
release with the better encode, but take **specific subtitle tracks** from a
different release (a preferred fansub). This runbook is the tested recipe for
that, using *Trapped in a Dating Sim* S1 as the worked example:

- **Video** from `…-TTGA` (the larger, better remux).
- **Audio** trimmed to **Japanese only**.
- **Subtitles**: only the two **Chihiro** tracks from `…-CRUCiBLE` (that release's
  per-type subtitle index **0** = dialogue and **2** = signs/songs; indexes 1/3
  were duplicate USBD tracks).
- Renamed to the AniDB Plex convention and moved into the library.

The same shape works for any "good video here, good subs there" merge.

## The one hard constraint: mux-magic pairs files by filename

`replaceTracks` (and `addSubtitles`) match the **source** file to the
**destination** file **by identical filename**. Two different release groups never
share a filename, so **rename both releases to the same canonical names first**
(`nameAnimeEpisodesAniDB` with the same `anidbId` + `seasonNumber` + `seriesName`
produces identical names). Only after both sides are renamed will the merge pair
up episode-for-episode.

## Working-directory layout

Stage a `work/` folder next to the sources and **copy** (don't move — keep the
originals so you can re-pull from source if a mux goes wrong) the files in:

```
…/<Series>/work/            <- the VIDEO base (good encode), one file per episode
…/<Series>/work/subs/       <- the SUBS donor release, one file per episode
…/<Series>/work/op-ed/      <- creditless OP/ED (if any), handled as a second pass
```

- `work/` is the base. `nameAnimeEpisodesAniDB`, `keepLanguages`, etc. read a
  folder **non-recursively**, so the `subs/` and `op-ed/` subfolders are ignored
  by any step pointed at `work/` — no cross-contamination.
- The source release folders (TTGA / CRUCiBLE) **stay** on disk until you've
  verified the output. Only the throwaway BD masters get deleted when done.

### Splitting the base release's episodes from its OP/ED

`copyFiles`/`moveFiles` copy a **whole directory** — they can't glob a subset, so
splitting a release that mixes episodes and creditless extras is a **shell step**,
not a mux-magic step. For TTGA's `S01E##-*.mkv` episodes vs `S01OP-*`/`S01ED-*`:

```bash
BASE="/mnt/Bunnies/Family/Downloads/~ANIME/<Series>"       # = /media/Downloads/~ANIME/<Series> inside mux-magic
TTGA="$BASE/<TTGA release folder>"
CRUCIBLE="$BASE/<CRUCiBLE release folder>"
mkdir -p "$BASE/work" "$BASE/work/subs" "$BASE/work/op-ed"
cp "$TTGA/"S01E[0-9][0-9]-*.mkv          "$BASE/work/"        # episodes -> base
cp "$TTGA/"S01OP-*.mkv "$TTGA/"S01ED-*.mkv "$BASE/work/op-ed/" # creditless -> op-ed
cp "$CRUCIBLE/"*.mkv                      "$BASE/work/subs/"   # subs donor
```

(On ZFS, `cp --reflink=auto` clones instantly and costs no space when block
cloning is enabled; plain `cp` is the safe fallback.)

## Flatten after every track op — don't chain into the subfolder

Each track op writes only the files it **actually changed** into a new subfolder
(`LANGUAGE-TRIMMED`, `REORDERED-TRACKS`, …). **Steps skip files that need no
change** — `keepLanguages` skips a file that's already single-language,
`replaceFlacWithPcmAudio` skips a file with no FLAC track, `replaceTracks` skips a
file with no filename match. If you chain the next step by pointing it at that
subfolder, **every skipped file silently vanishes** from the set.

The fix (and the reason `flattenOutput` exists): after each op, `flattenOutput`
copies the subfolder's contents **up one level onto the working dir**, overwriting
the originals — so changed files get updated in place and unchanged files stay put.
The working dir is always the **complete, current** set, and the next step reads it
flat. `deleteSourceFolder: true` removes the now-empty subfolder so the tree stays
clean. Use `flattenOutput`, **not** `copyFiles` — it overwrites instead of tripping
"Refusing to overwrite existing destination".

## The pipeline (main episodes)

Order: **rename both sides first**, then each op is `<track-op>` → `flattenOutput`
back onto its working dir, then move, then delete `work/`.

1. **`nameAnimeEpisodesAniDB` on `work/`** — `anidbId`, `seasonNumber: 1`,
   `seriesName`, `filenameRegex: 'S\d+E(?<episodeNumber>\d+)'`. Renames the base
   episodes to `<Series> - s01eNN - <Title>.mkv` (in place, all files).
2. **`nameAnimeEpisodesAniDB` on `work/subs/`** — identical params → identical
   filenames, so the merge can pair them.
3. **`keepLanguages` on `work/`** → `LANGUAGE-TRIMMED`, then **`flattenOutput`**
   back onto `work/`. `audioLanguages: [jpn]`, `subtitlesLanguages: [jpn]`: keeps
   Japanese audio and **drops the English subs** (see gotcha).
4. **`reorderTracks` on `work/subs/`** → `REORDERED-TRACKS`, then **`flattenOutput`**
   back onto `work/subs/`. `subtitlesTrackIndexes: [0, 2]`, `videoTrackIndexes: []`,
   `audioTrackIndexes: []`. Dropping video/audio is fine — files match by extension
   (`.mkv`), so a subs-only mkv is still a valid `replaceTracks` source, and it's
   tiny/fast.
5. **`replaceTracks`** — `sourcePath: work/subs`, `destinationFilesPath: work`,
   `subtitlesLanguages: [eng]` (the Chihiro tracks' language), `audioLanguages: []`,
   `videoLanguages: []`, **`includeChapters: false`** (see gotcha) → `REPLACED-TRACKS`,
   then **`flattenOutput`** back onto `work/`.
6. **`replaceFlacWithPcmAudio` on `work/`** → `AUDIO-CONVERTED`, then
   **`flattenOutput`** back onto `work/`.
7. **`moveFiles`** — `work/` → the library folder
   `/media/Anime/<Series> [anidb-<id>]`. `moveFiles` is depth-0 (flat), so it moves
   the finished episodes and leaves the `subs/`/`op-ed/` subfolders behind.
8. **`deleteFolder`** — `sourcePath: work`, `confirm: true`. Only after **op-ed has
   already run and been verified** (see below) — this removes `work/` and everything
   left in it.

Nothing mutates a copy in place except the in-`work/` overwrite that `flattenOutput`
does deliberately; the source release folders are never touched.

## Gotchas (these are the load-bearing details)

### `includeChapters: false` when the base already has chapters
`replaceTracks`'s `includeChapters` controls whether chapters are pulled from the
**source** (the subs donor). The **destination** (video base) **always keeps its
own** chapters — the `--no-chapters` flag is only ever applied to the source
input. So if the base (TTGA) already has good chapters, set
**`includeChapters: false`** — otherwise you *add* the donor's (CRUCiBLE's)
chapters on top, which is not what you want.

### "Audio + subs Japanese only" when there are no Japanese subs
For this title there are **no Japanese subtitle tracks anywhere** — the base's
subs are English (Signs/Dialogue) and the wanted fansub subs are English too. So
"subs only Japanese" resolves to: keep Japanese **audio**, and **drop the base's
English subs** (they're being replaced by the donor's). `keepLanguages` with
`subtitlesLanguages: [jpn]` achieves the drop, because mkvmerge's
`--subtitle-tracks jpn` on a file that has no jpn subs keeps **zero** subs. (There
is a zero-audio guard but **no** zero-subtitle guard, so this is safe and
intended — see the keepLanguages zero-audio decision.)

### Track selection by index lives only in `reorderTracks`
`replaceTracks`/`extractSubtitles`/`keepLanguages` all select by **language**, not
track index. The only command that selects specific tracks by **per-type index**
(the "tracks 0 and 2" the user asked for) is `reorderTracks`. So the pattern is:
`reorderTracks` to isolate the exact tracks → then `replaceTracks` (by language)
to move whatever survived. Per-type index = the Nth track *of that type* (0-based),
not the global track ID — verify with `mkvmerge -J <file>` before trusting an
index.

### Language codes are ISO 639-2 three-letter
`jpn`, `eng`, `fra` — not `ja`/`en`.

## Creditless OP/ED — run this pass FIRST

The OP/ED come from the base release only (the subs donor has none), so they don't
need a merge — just Japanese audio + FLAC→PCM + credits naming. **Run this small
pass first** to prove the flatten/move/cleanup shape on two easy files before
committing the 12-episode run. It operates entirely inside `work/op-ed/`:

1. `nameAnimeEpisodesAniDB` — `anidbId`, **`episodeType: credits`** (AniDB type 3).
   Lands them at `s00e301` / `s00e302` (see the credits-numbering note).
2. `keepLanguages` — `audioLanguages: [jpn]`, `subtitlesLanguages: [jpn]` →
   `LANGUAGE-TRIMMED`, then `flattenOutput` back onto `work/op-ed/`.
3. `replaceFlacWithPcmAudio` → `AUDIO-CONVERTED`, then `flattenOutput` back onto
   `work/op-ed/`.
4. `moveFiles` `work/op-ed/` → the same `[anidb-<id>]` series folder (Season 0
   lives in the series folder).

`episodeType: credits` uses an interactive length-matched picker; with only the
two files in `work/op-ed/` it just asks you to confirm OP→C1, ED→C2. **Note:** the
`s00e301`-style numbering needs the running app built from
[PR #207](https://github.com/Sawtaytoes/mux-magic/pull/207); an older build emits
`s00e01`.

## Cleanup — delete `work/` at the very end

`work/` (and its `subs/` + `op-ed/` children) are throwaway staging. Once **both**
passes have moved their output into the library **and you've verified it**, delete
the whole thing in one shot: `deleteFolder` with `sourcePath: <…>/work` and
`confirm: true`. The source release folders (TTGA / CRUCiBLE) stay — only the
`work/` copies go.

## Why two YAMLs instead of one

The episodes pass and the OP/ED pass are two independent multi-step streams that
converge on the same library folder. mux-magic **cannot** run them as two parallel
streams in one sequence — groups are flat-only (a parallel group holds bare steps,
not sequential sub-groups). See the decision
[`groups-are-flat-only-no-parallel-of-sequences`](decisions/2026-08-13-groups-are-flat-only-no-parallel-of-sequences.md).
Until that's built, run the two YAMLs separately.
