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
…/<Series>/work/op-ed/      <- creditless OP/ED (if any) — only until they're renamed
```

- `work/` is the base. `nameAnimeEpisodesAniDB`, `keepLanguages`, etc. read a
  folder **non-recursively**, so the `subs/` and `op-ed/` subfolders are ignored
  by any step pointed at `work/` — no cross-contamination.
- The source release folders (TTGA / CRUCiBLE) **stay** on disk until you've
  verified the output. Only the throwaway BD masters get deleted when done.

**The split is only needed for the renames.** `op-ed/` exists solely because the
creditless extras need a *different* rename call (`episodeType: credits`) than the
episodes. Once renamed, the names can't collide (`s00e301`/`s00e302` vs
`s01e01`…`s01e12`), so **fold `op-ed/` back into `work/`** with a `flattenOutput`
(`deleteSourceFolder: true` — it copies the contents up one level into the parent
and removes the folder). Every step after that runs **once** over the whole set
instead of being duplicated per folder. Don't fold `subs/` in — it's a donor whose
filenames intentionally mirror the episodes.

### Splitting the base release's episodes from its OP/ED

`copyFiles` takes a **`fileFilterRegex`** (a `{ pattern, flags }` object, or a bare
string that's treated as the pattern), so staging a subset is a mux-magic step —
no shell needed. Point `sourcePath` at the release folder and filter to the files
you want. For TTGA's `S01E##-*.mkv` episodes vs `S01OP-*`/`S01ED-*`, and the whole
CRUCiBLE folder:

```yaml
- id: stageEpisodes
  command: copyFiles
  params:
    sourcePath: /media/Downloads/~ANIME/<Series>/<TTGA folder>
    destinationPath: /media/Downloads/~ANIME/<Series>/work
    fileFilterRegex: {pattern: '^S\d+E\d+-', flags: i}     # episodes only (not OPxx/EDxx)
- id: stageCreditless
  command: copyFiles
  params:
    sourcePath: /media/Downloads/~ANIME/<Series>/<TTGA folder>
    destinationPath: /media/Downloads/~ANIME/<Series>/work/op-ed
    fileFilterRegex: {pattern: '^S\d+(OP|ED)', flags: i}   # creditless only
- id: stageSubs
  command: copyFiles
  params:
    sourcePath: /media/Downloads/~ANIME/<Series>/<CRUCiBLE folder>
    destinationPath: /media/Downloads/~ANIME/<Series>/work/subs
    fileFilterRegex: {pattern: '\.mkv$', flags: i}
```

`copyFiles` creates the destination folders, so no pre-`mkdir`. Note the pattern
`^S\d+E\d+-` matches `S01E01-…` but **not** `S01ED-…`/`S01OP-…` (no digit after the
`E`), which is exactly the split we want. `copyFiles` does a real copy, so the
source release folders are untouched — keep them until the output is verified.

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

## The pipeline

Shape: **stage into 3 folders → 3 renames → fold `op-ed/` into `work/` → everything
else once**, with each track op followed by a `flattenOutput` back onto its working
dir.

1. **`copyFiles` ×3** (parallel-safe) — episodes → `work/`, creditless → `work/op-ed/`,
   subs donor → `work/subs/`, each with its `fileFilterRegex`.
2. **`nameAnimeEpisodesAniDB` on `work/`** — `anidbId`, `seasonNumber: 1`,
   `seriesName`, `filenameRegex: 'S\d+E(?<episodeNumber>\d+)'` → `<Series> - s01eNN - <Title>.mkv`.
3. **`nameAnimeEpisodesAniDB` on `work/subs/`** — identical params → identical
   filenames, so the merge can pair them.
4. **`nameAnimeEpisodesAniDB` on `work/op-ed/`** — `episodeType: credits` →
   `s00e301`/`s00e302`. Keep the three renames **serial** (see the AniDB note below).
5. **`flattenOutput` on `work/op-ed/`** (`deleteSourceFolder: true`) — the renamed
   creditless files join the episodes in `work/`. From here there is **one** set.
6. **`keepLanguages` on `work/`** → `LANGUAGE-TRIMMED`, then **`flattenOutput`** back
   onto `work/`. `audioLanguages: [jpn]`, `subtitlesLanguages: [jpn]`: keeps Japanese
   audio and **drops the English subs** (see gotcha). Runs over all 14 files at once.
7. **`reorderTracks` on `work/subs/`** → `REORDERED-TRACKS`, then **`flattenOutput`**
   back onto `work/subs/`. `subtitlesTrackIndexes: [0, 2]`; leave `videoTrackIndexes`
   / `audioTrackIndexes` unset (they default to `[]`). Dropping video/audio is fine —
   files match by extension (`.mkv`), so a subs-only mkv is still a valid
   `replaceTracks` source, and it's tiny/fast. Steps 6 and 7 are independent → one
   parallel group.
8. **`replaceTracks`** — `sourcePath: work/subs`, `destinationFilesPath: work`,
   `subtitlesLanguages: [eng]` (the donor tracks' language),
   **`includeChapters: false`** (see gotcha) → `REPLACED-TRACKS`, then
   **`flattenOutput`** back onto `work/`. **The OP/ED have no same-named file in
   `subs/`, so they're skipped and never enter `REPLACED-TRACKS` — the flatten is
   what keeps them in the set.** This is the clearest case for the flatten rule.
9. **`replaceFlacWithPcmAudio` on `work/`** → `AUDIO-CONVERTED`, then
   **`flattenOutput`** back onto `work/`.
10. **`moveFiles`** — `work/` → `/media/Anime/<Series> [anidb-<id>]`. Depth-0, so it
    moves all 14 finished files and leaves the `subs/` subfolder behind.
11. **`deleteFolder`** — `sourcePath: work`, `confirm: true`.

Nothing mutates a copy in place except the in-`work/` overwrite that `flattenOutput`
does deliberately; the source release folders are never touched.

**Don't over-split the work.** An earlier draft of this ran `keepLanguages`,
`replaceFlacWithPcmAudio`, the flattens and the final move **twice** — once for
`work/`, once for `work/op-ed/` — and paid for it with duplicated steps and extra
parallel groups. Folding `op-ed/` in right after its rename removes all of that.

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

### Creditless OP/ED only need their own *rename*

The OP/ED come from the base release only (the subs donor has none), so the sole
thing that makes them special is the rename call: `episodeType: credits` (AniDB
type 3) → `s00e301`/`s00e302`. Everything else (Japanese audio, FLAC→PCM, the move)
is the **same work as the episodes**, so fold them into `work/` right after the
rename and let the shared steps handle all 14 files.

`episodeType: credits` uses an interactive length-matched picker; with only the two
files in `work/op-ed/` it just asks you to confirm OP→C1, ED→C2. **Note:** the
`s00e301`-style numbering requires a build that includes
[PR #207](https://github.com/Sawtaytoes/mux-magic/pull/207); an older build emits
`s00e01`/`s00e02`, and Season 0 files live in the same series folder either way.

## Validate the YAML before running it

Check a sequence with **no side effects** first — it runs the same envelope +
per-command param schemas the runner uses, so "valid here" means "won't be
rejected there". POST the YAML as a string; use the **`/api`** prefix and
`Accept: application/json` (the bare `/sequences/validate` path returns the SPA):

```bash
python3 - <<'PY'
import json, urllib.request
yaml = open("sequence.yaml").read()
req = urllib.request.Request(
    "https://mux-magic.octen.dev/api/sequences/validate",
    data=json.dumps({"yaml": yaml}).encode(),
    headers={"Content-Type": "application/json", "Accept": "application/json"},
)
print(urllib.request.urlopen(req).read().decode())   # {"errors":[],"isValid":true}
PY
```

Two flow-syntax traps that this catches (both hit while writing this runbook):
inline `{...}` params break on a value containing `[...]` (e.g. the
`[anidb-<id>]` library path reads as a nested flow list) — use **block-style
params and single-quote every path**. `[jpn]` / `[0, 2]` / `[]` are real flow
sequences and stay as-is.

## Cleanup — delete `work/` at the very end

`work/` (and its `subs/` child) is throwaway staging. Once the move has landed
everything in the library **and you've verified it**, delete the whole thing in one
shot: `deleteFolder` with `sourcePath: <…>/work` and `confirm: true`. The source
release folders (TTGA / CRUCiBLE) stay — only the `work/` copies go.

## One sequence, with parallel groups for the independent ops

It's all one **sequential** YAML: stage → rename → fold in `op-ed/` → shared track
ops → move → delete `work/`. Where independent bare steps line up, wrap them in a
`kind: group` / `isParallel: true` group to run them concurrently — the ones that
survive the simplification:

- the three `copyFiles` stages;
- `keepLanguages` (`work/`) + `reorderTracks` (`work/subs/`) — different folders;
- their two `flattenOutput`s.

Note what is **not** parallel: after `op-ed/` is folded in there's only one set of
files, so `replaceFlacWithPcmAudio` and the final `moveFiles` each run once. Reach
for a parallel group when two steps touch **different folders**, not as a default.

**Renames are the exception — don't blindly parallelize them.** `nameAnimeEpisodesAniDB`
looks up AniDB, and the throttle in `anidbApi.ts` is a timestamp check, **not a
mutex**: it spaces out *sequential* calls (1 req / 2.5s) but three calls fired in
one parallel group with a **cold cache** all read the same `lastRequestAt`, all
compute `wait <= 0`, and hit AniDB simultaneously — a ban risk. It's only safe when
the series' `<aid>.xml` is already cached fresh (7-day TTL, under the app's
`cache/anime/`), in which case every call reads the disk and never fetches. So:
run the renames **serial**, or **warm the cache** with one lookup before a parallel
rename group. The credits pass also uses an interactive picker, so it pauses for
confirmation regardless.

Two hard limits to remember:

- **`isParallel` is honored only on the server run path** ("▶ Run on Server"). The
  client "▶ Run Sequence" runs everything serially.
- A parallel group holds **bare steps only** — groups are flat-only, so you can't
  run two multi-step *streams* in parallel (no parallel-of-sequences). See the
  decision [`groups-are-flat-only-no-parallel-of-sequences`](decisions/2026-08-13-groups-are-flat-only-no-parallel-of-sequences.md).
  Folding `op-ed/` into `work/` sidesteps the limitation entirely: there's only one
  stream left to run.

The AniDB throttle race is tracked as
[issue #210](https://github.com/Sawtaytoes/mux-magic/issues/210); once it's a real
mutex, the renames can join a parallel group too.
