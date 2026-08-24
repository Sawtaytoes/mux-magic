# Picard parity — the behaviour and the defaults the Mux-Magic tagger must ship

*Companion to [the build plan](music-tagging-plan.md) and
[the decision](decisions/2026-08-24-the-tagger-reproduces-picard-defaults-exactly.md).*

Everything here was **read from the owner's real `Picard.ini` files (MusicBrainz Picard
2.13.3)**, not reconstructed from the Picard documentation. It is the configuration that
produced the existing library, so it is the definition of "the way I do it today".

**Two machines, plus an eight-year-old copy, were compared. They agree.** The method and the
few differences are in [§11](#11-verified-across-two-machines-and-eight-years).

> **Portable.** Nothing below names a real path, a real host or a real key. Library and
> inbox roots appear as `<LIBRARY_ROOT>` and `<INBOX_ROOT>`. The owner's AcoustID API key
> **was deliberately not copied into this document** — it belongs in the gitignored `.env`
> only. This file may move into the public `mux-magic` repo as written.

Every value below is a **default**, and every one of them is configurable. The point of
recording them is that the defaults must reproduce the current library exactly, so that
re-tagging an already-filed album is a no-op.

---

## 1. The file naming rule — this is the part with the "very particular way"

The selected script is Picard's **Preset 1** (the built-in default naming script),
unmodified:

```
$if2(%albumartist%,%artist%)/
$if(%albumartist%,%album%/,)
$if($gt(%totaldiscs%,1),$if($gt(%totaldiscs%,9),$num(%discnumber%,2),%discnumber%)-,)$if($and(%albumartist%,%tracknumber%),$num(%tracknumber%,2) ,)$if(%_multiartist%,%artist% - ,)%title%
```

Read out as rules, in the order they apply:

1. **Folder 1 is the album artist**, and falls back to the track artist when there is no
   album artist.
2. **Folder 2 is the album**, and it is **omitted entirely when there is no album artist**.
   A track with no album artist lands directly in the artist folder.
3. **The disc prefix appears only when the release has more than one disc.** It is
   `<disc>-` with no padding, so `1-`, `2-`. It becomes **zero-padded to two digits only
   when the release has more than nine discs** — `01-`, `02-`.
4. **The track number is zero-padded to two digits and followed by a space**, not a dot and
   not a hyphen. It is omitted when there is no album artist or no track number.
5. **The track artist and " - " are inserted only on a multi-artist release**
   (`%_multiartist%` — set when the tracks on the release do not all share one artist).
6. **The title ends the name.** The extension is added by the writer.

### Worked examples — these are the acceptance tests

| Case | Result |
| --- | --- |
| Single-disc album | `<LIBRARY_ROOT>/Artist Name/Album Name/01 Track Title.flac` |
| **Multi-disc album, 2–9 discs** | `<LIBRARY_ROOT>/Artist Name/Album Name/1-01 Track Title.flac` |
| **Multi-disc album, 10+ discs** | `<LIBRARY_ROOT>/Artist Name/Album Name/01-01 Track Title.flac` |
| Compilation / various-artists release | `<LIBRARY_ROOT>/Various Artists/Album Name/01 Track Artist - Track Title.flac` |
| Multi-disc compilation | `<LIBRARY_ROOT>/Various Artists/Album Name/2-05 Track Artist - Track Title.flac` |
| No album artist at all | `<LIBRARY_ROOT>/Track Artist/Track Title.flac` |

⚠️ **Every disc of a multi-disc release sits in one album folder.** There are no `Disc 1`
and `Disc 2` subfolders. The disc number lives in the filename prefix and nowhere else.
This is the single most common way a re-implementation gets this wrong.

⚠️ **The separator after the track number is a space.** `01 Title`, never `01. Title` or
`01 - Title`. Getting this wrong renames the entire existing library.

The naming engine therefore has to support, at minimum, conditional segments, a "first
non-empty of" function, numeric comparison, zero-padding, and the derived
`_multiartist` flag. A plain `{albumartist}/{album}/{track} {title}` template **cannot**
express these rules. Either implement the Picard script functions (`$if`, `$if2`, `$and`,
`$gt`, `$num`), or design a template language that covers all six rules above and prove it
against the table.

### Path safety, as configured

| Setting | Value | Meaning |
| --- | --- | --- |
| `windows_compatibility` | **true** | Strip characters Windows forbids, even though the files live on a NAS. The library is read over SMB from Windows, so this stays on. |
| `win_compat_replacements` | `\|`, `?`, `>`, `<`, `:`, `*`, `"` → `_` | Each forbidden character becomes an underscore. Not deleted, not stripped — replaced one for one. |
| `replace_dir_separator` | `_` | A `/` inside a title becomes `_`, it does not create a folder. |
| `windows_long_paths` | true | Allow paths past 260 characters. |
| `ascii_filenames` | **false** | **Do not transliterate.** Japanese titles and curly quotes stay as they are. |
| `replace_spaces_with_underscores` | false | Spaces are spaces. |
| `delete_empty_dirs` | true | Remove a source folder left empty after the move. |
| `preserve_timestamps` | **true** | The file's modification time survives tagging. |
| `move_additional_files` | **false** | Logs, cue sheets and scans stay where they are; they are not dragged into the library. |

---

## 2. Cover art

| Setting | Value |
| --- | --- |
| Provider order | Cover Art Archive → release URL relationships → CAA release group → TheAudioDB → local files |
| Image types | **front only** (`caa_restrict_image_types=true`) |
| Types never used | `matrix/runout`, `raw/unedited`, `watermark` |
| Size | **original / full size** (`caa_image_size=-1`) |
| Approved-only | false — unapproved CAA images are allowed |
| Embed in tags | **true**, and **one front image only** |
| Save beside the files | **true**, as `cover.<ext>`, **never overwriting** an existing file |
| Type as filename | false |
| Existing local art | matched by `^(?:cover|folder|albumart)(.*)\.(?:jpe?g|png|gif|tiff?|webp)$` |
| Keep art already in the file | **false** (`preserve_images=false`) — the new front image replaces it |

So each album folder ends with **one `cover.jpg` on disk and one embedded front image per
file**, at full resolution.

---

## 3. Matching and lookup thresholds

| Setting | Value | Meaning |
| --- | --- | --- |
| `file_lookup_threshold` | 0.7 | Minimum similarity to auto-accept a single-file lookup. |
| `cluster_lookup_threshold` | 0.7 | Same, for a whole cluster. |
| `track_matching_threshold` | **0.4** | Below this a track is not matched to a release track at all. |
| `ignore_track_duration_difference_under` | **2 s** | Duration differences under two seconds do not count against a match. |
| `query_limit` | 50 | Candidates fetched per search. |
| `cluster_new_files` | **true** | Files are grouped into albums by tags as soon as they are added. |
| `analyze_new_files` | false | Fingerprinting is **not** automatic. It is an explicit action. |
| `ignore_file_mbids` | false | An MBID already in a file is trusted and used. |

**`cluster_new_files=true` plus `analyze_new_files=false` is the whole workflow in two
settings:** cluster by existing tags first, look the cluster up, and reach for
fingerprinting only when that fails. The tagger should behave the same way — fingerprinting
every file on import is slow and was deliberately turned off.

The confidence numbers map directly onto the `SmartMatchModal` pattern, which already has a
`LOW_CONFIDENCE_THRESHOLD` of 0.6. Do not silently reuse 0.6 here; music has its own three
thresholds and they are not the same number.

---

## 4. Which release gets picked

| Setting | Value |
| --- | --- |
| `preferred_release_countries` | **US, JP** — in that order |
| `preferred_release_formats` | **Digital Media, CD** — in that order |
| `release_type_scores` | every type weighted **0.5** — album, single, EP, soundtrack, compilation and the rest are all equal |

The country and format preferences are a real ranking input, not a filter. A Japanese CD
pressing outranks a European one for the same release group.

---

## 5. Metadata style

| Setting | Value | Meaning |
| --- | --- | --- |
| `translate_artist_names` | **true**, locale `en` | Latin-script artist names, with the English alias preferred. |
| `translate_artist_names_script_exception` | false | No script-based exception to that. |
| `standardize_artists` | **true** | Use the artist's standard name, not the credited-as name. |
| `standardize_instruments` | true | Same for instrument credits. |
| `convert_punctuation` | **false** | Curly quotes and long dashes are kept as MusicBrainz has them. |
| `va_name` | `Various Artists` | The exact folder name for compilations. |
| `release_ars` / `track_ars` | true | Fetch release-level and track-level relationships (performers, composers, arrangers). Soundtracks need these. |
| `guess_tracknumber_and_title` | true | Derive a track number and title from the filename when tags have none. |

### Genres

| Setting | Value |
| --- | --- |
| `use_genres` | true |
| `max_genres` | **5** |
| `min_genre_usage` | **90** |
| `join_genres` | *(empty — genres stay a multi-value tag, not one joined string)* |
| `genres_filter` | excludes `seen live`, `favorites`, `fixme`, `owned` |
| `artists_genres` | true — fall back to the artist's genres |
| `folksonomy_tags` | true — use folksonomy tags as well as genres |
| `only_my_genres` | false |

The four excluded tags are other people's listening habits leaking into a genre field. The
filter is not optional decoration; without it, albums get tagged `owned`.

---

## 6. Formats and format-specific rules

| Setting | Value | Meaning |
| --- | --- | --- |
| `remove_ape_from_mp3` | false | Leave an APE tag on an MP3 alone. |
| `remove_id3_from_flac` | false | Leave a stray ID3 tag on a FLAC alone. |
| `fix_missing_seekpoints_flac` | **true** | Repair FLAC seek tables while saving. |
| `dont_write_tags` | false | Tags are written. |
| `ignore_hidden_files` | true | |
| `recursively_add_files` | true | |

---

## 7. Picard behaviour that is not a setting, and must still be built

These are the parts of Picard the owner actually uses. They are the feature list, and the
config above is only how they are tuned.

1. **Cluster** — group loose files into candidate albums from their existing tags, before
   any lookup. This is what makes a folder of untagged files workable.
2. **Lookup** — search MusicBrainz for the cluster and attach the best release.
3. **Scan** — AcoustID fingerprint the selected files and match by audio, for files whose
   tags are wrong or missing.
4. **Manual release search** — reject the match and pick another release by hand, from a
   list showing country, format, year, track count and label. This is the step that stops a
   wrong match, and the tagger must have it.
5. **The two-pane view** — unmatched files on the left, matched releases with their tracks
   on the right, and per-track match icons. The tagger's table replaces this, but it must
   keep what the two panes show: which files matched, which did not, and how well.
6. **The tag difference view** — original value beside new value, per tag, per file, before
   saving. Picard colours added, changed and removed tags differently. **This is the review
   step, and it is the reason a blind CLI run was rejected.**
7. **Save** — write tags, rename, move, in one action, with a per-file result.
8. **Submit AcoustID fingerprints** back to AcoustID (`save_acoustid_fingerprints=true`).
   This gives back to the database the tagger reads from; keep it.
9. **Open in browser** — jump to the release page on MusicBrainz to check something by eye.
10. **Per-file info** — codec, bit depth, sample rate, length, existing tags.

### MP3Tag behaviour the tagger must also cover

Picard does not do these, which is why the owner runs two applications:

1. **Bulk edit of a field across a selection** — set album artist, year or genre on 40 files
   at once, without a MusicBrainz match behind it.
2. **Find and replace across a field**, over a selection.
3. **Free-hand editing of any tag**, including tags MusicBrainz has no opinion about.
4. **The VGMdb source**, which in MP3Tag is a custom script. It is the reason MP3Tag is in
   the workflow at all.

---

## 8. Plugins in use, and what they mean for the build

`enabled_plugins = acousticbrainz, fix_tracknums, mastroka, theaudiodb`

| Plugin | What it does | Verdict for the tagger |
| --- | --- | --- |
| `fix_tracknums` | Corrects track numbers that disagree with the release | **Build it.** Small, and it fixes a real recurring problem. |
| `theaudiodb` | An extra cover-art source | Build it as a fourth art provider, after CAA. |
| `mastroka` *(sic — the plugin's own spelling)* | Matroska tag support | Only matters for `.mka`. Low priority. |
| `acousticbrainz` | Fetched AcousticBrainz mood and key data | ⚠️ **Do not build.** The AcousticBrainz project stopped collecting data in 2022. It is a dead source; whatever it still fills in is frozen. Confirm before spending any effort on it. |

⚠️ **This plugin list is the weakest claim in this document.** It is enabled on **one** of the
two machines. The other has **no plugins enabled at all** and still produces the same library,
which means none of the four is load-bearing for the file structure. Treat the four as
*wanted*, not as *required*, and ask before building any of them. See
[§11](#11-verified-across-two-machines-and-eight-years).

---

## 9. What we deliberately do not carry over

- **CD lookup from a drive letter.** The tagger runs on the NAS and has no optical drive.
  Disc work belongs to Rip-Deck.
- **The browser-integration port** (Picard listens on `:8000` so a MusicBrainz page can push
  a release into it). The tagger is already a web application; a "load this release" URL
  parameter replaces it.
- **Ratings submission.** Disabled today (`enable_ratings=false`).
- **Tagger scripts.** Disabled today (`enable_tagger_scripts=false`). The naming script is
  separate and is in [§1](#1-the-file-naming-rule--this-is-the-part-with-the-very-particular-way).
- **The Picard update checker.**

---

## 10. Acceptance test

The tagger is at parity when, given an album already correctly filed in the library, a
full run produces **zero renames, zero moves and zero tag changes**. Any difference is a
defect in the naming rules or in the metadata style, and it is cheap to test because the
existing library is thousands of already-correct examples.

---

## 11. Verified across two machines, and eight years

The first pass read one machine. The owner asked for a second opinion from the other one,
because the two might disagree. They do not, on anything that shapes a file.

| Source | Picard | Date | Read from |
| --- | --- | --- | --- |
| Tagging machine, **live** | 2.13.3 | current | SSH, `%APPDATA%\MusicBrainz\Picard.ini` |
| Desktop, **backup** | 2.13.3 | 2026-08-19 | the Windows user-profile backup on the NAS |
| Desktop, **old backup** | **1.4.2** | **2018-02-11** | the same backup tree |

### The naming script is byte-identical on both current machines

Not "equivalent" — the whole `file_renaming_scripts` blob matches on an `md5sum`, and both
machines select `Preset 1`. Both carry only the three stock presets, so **there is no custom
naming script anywhere**, and the rules in [§1](#1-the-file-naming-rule--this-is-the-part-with-the-very-particular-way)
are the specification for both.

*(Preset 3, present but not selected on both, is the same rule without the past-nine-discs
padding. If a file in the library ever shows a `10-` prefix where `01-` was expected, this
preset is the first thing to check.)*

### Every other setting is identical too

A key-by-key comparison of the two 2.13.3 configs, with the Qt binary window-geometry blobs
excluded, leaves **five** differences and **not one of them changes an output file**:

| Difference | Verdict |
| --- | --- |
| `enabled_plugins` — four on the tagging machine, **none on the desktop** | The one real finding. See the warning in [§8](#8-plugins-in-use-and-what-they-mean-for-the-build). |
| `current_browser_path`, `starting_directory_path` | Where each machine last browsed. UI state. |
| `options_last_active_page` | Which options page was open last. UI state. |
| `last_update_check` | A timestamp. |
| `preserved_tags` | Empty on both; the key is simply absent on one. |

Everything that matters matched exactly: the naming script, the cover-art rules, all three
matching thresholds, the release-country and format preferences, the genre settings and their
filter, `windows_compatibility`, `preserve_timestamps`, `move_additional_files` and the
move/rename destination behaviour.

### The 2018 copy shows the convention has not moved in eight years

The Picard 1.4.2 config from February 2018 stores its rule in the old single-line
`file_naming_format` key, and it is **the same rule**:

```
$if2(%albumartist%,%artist%)/$if($ne(%albumartist%,),%album%/,)$if($gt(%totaldiscs%,1),%discnumber%-,)$if($ne(%albumartist%,),$num(%tracknumber%,2) ,)$if(%_multiartist%,%artist% - ,)%title%
```

Same artist folder, same album folder, **same `<disc>-` prefix only when there is more than
one disc**, same zero-padded track number followed by a space, same multi-artist rule. Only two
things changed between 2018 and now: the past-nine-discs padding was added by the newer preset,
and `$ne(%albumartist%,)` became `$if(%albumartist%,…)`, which is the same test written
differently.

Three settings did change over those years, and the current values are the ones to use:
`move_files` was **off** in 2018 and is on now, `caa_image_size` was 500 px and is now full
size, and there were no preferred release countries.

**So the file structure is not a recent preference — it is what the entire library has been
built on since 2018.** That is why the acceptance test in [§10](#10-acceptance-test) is
strict: any deviation renames files that have been correct for eight years.

### Credentials seen and not recorded

Both configs contain a MusicBrainz **OAuth access token and refresh token**, and the tagging
machine's also holds the **AcoustID API key**. All three were read during this comparison and
**none was copied into any file.** They belong in the gitignored `.env` only, never in a
document that can become public.
