# 2026-08-24 — The tagger's defaults reproduce Picard exactly, and re-tagging a filed album is a no-op

- **Status:** Accepted
- **Date decided:** 2026-08-24
- **Area:** core / web
- **Source:** owner's live `Picard.ini` (MusicBrainz Picard 2.13.3), read over SSH from two machines plus a 2018 backup; parity doc `docs/picard-parity.md`

## Decision

Mux-Magic's music tagger replaces MusicBrainz Picard and MP3Tag. Every one of its defaults is the value read from the owner's live Picard configuration, which is the configuration that built the existing library. Every default is configurable; the point of the defaults is that they reproduce the current library exactly.

**The acceptance test is a no-op.** Given an album already correctly filed in the library, a full tagger run produces zero renames, zero moves and zero tag changes. Any difference is a defect.

The file naming rule is Picard's Preset 1, unmodified, and it is **conditional**:

1. Folder 1 is the album artist, falling back to the track artist.
2. Folder 2 is the album, and **disappears entirely when there is no album artist**.
3. The disc prefix appears **only** on a multi-disc release, as `<disc>-`, and gains a second digit **only past nine discs**.
4. The track number is zero-padded to two digits and followed by **a space**.
5. The track artist and ` - ` appear **only** on a multi-artist release.
6. The title ends the name.

## What we rejected — DO NOT revert to this

**A flat `{albumartist}/{album}/{track} {title}` template.** It cannot express any of the six rules above. This is the single most likely drift, because it looks like it works on a normal single-disc album and only breaks on the conditional cases.

**`Disc 1` / `Disc 2` subfolders.** Every disc of a multi-disc release sits in **one** album folder. The disc number lives in the filename prefix and nowhere else. The parity doc calls this out as the most common way a re-implementation gets it wrong.

**`01. Title` or `01 - Title`.** The separator after the track number is a space. Getting this wrong renames the entire existing library.

**Reusing `LOW_CONFIDENCE_THRESHOLD = 0.6` from the Smart Match scorer.** Music has three thresholds of its own — file lookup 0.7, cluster lookup 0.7, track matching 0.4 — plus a two-second duration grace. They are not the same number and they are not interchangeable.

**Fingerprinting every file on import.** `cluster_new_files=true` with `analyze_new_files=false` is the owner's whole workflow in two settings: cluster by existing tags first, look the cluster up, and reach for fingerprinting only when that fails. Fingerprinting on import is slow and was turned off deliberately.

**Transliterating filenames.** `ascii_filenames=false`. Japanese titles and curly quotes stay as they are. Windows-forbidden characters are replaced one for one with `_`, not deleted.

**Building the `acousticbrainz` plugin.** That project stopped collecting data in 2022. It is a dead source.

## Why it must not be re-litigated

The library has been built on this exact structure since **February 2018** — the 2018 Picard 1.4.2 config carries the same rule, and the two current machines agree on it byte for byte. It is not a recent preference. Any deviation renames files that have been correct for eight years, on a share with **no Recycle Bin**, where the only safety net is an hourly ZFS snapshot.

The no-op acceptance test is cheap to run and hard to argue with, because the existing library is thousands of already-correct examples.
