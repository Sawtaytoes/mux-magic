# 2026-08-24 — The bulk tag command and the reviewed per-file write stay separate

- **Status:** Accepted
- **Date decided:** 2026-08-24
- **Area:** core / server/api / web
- **Source:** branch `feat/music-tagging-commands`; [music-tagging-plan.md](../music-tagging-plan.md) §5

## Decision

Two surfaces write audio tags, and they do different jobs.

1. **`writeAudioTags`, the app-command.** One tag set applied to every audio
   file under a folder, with no MusicBrainz match behind it. This is MP3Tag's
   bulk field edit: set album artist, year or genre on 40 files at once. It is
   sequenceable, it has `isDryRun`, and it is registered in the builder.
2. **`POST /music/tags`, a plain route.** One row of the tag review table, one
   request, each with its own tag set. `TagMatchModal` posts these sequentially
   on Apply.

Neither one applies a per-file MusicBrainz proposal without a human reading the
diff first.

## What we rejected — DO NOT revert to this

**A `writeAudioTags` command that takes the match command's output and applies
every proposal.** It is the obvious "finish the pipeline" move — `scanAudioFiles`
→ `matchMusicBrainzRelease` → `writeAudioTags`, all three in one sequence, no
human in the middle. Do not build it. It is the blind CLI run the owner rejected
when this work started, and
[the parity doc](../picard-parity.md) §7.6 records why: the tag difference view
IS the feature. A wrong match writes wrong tags into files that are then filed
into wrong folders by `renameAndMoveAudioFiles`, and the only evidence of what
the file used to say is gone.

**Also rejected: making the reviewed write a command too**, so that Apply starts
a job. Apply is forty independent writes. One job id for all of them means one
failure reads as forty, and the modal renders one row per request and needs the
reason as data on that row — not a status code for the batch. The route returns
`200` with `isOk: false` and the message for the same reason.

## Why it must not be re-litigated

The split is the whole shape of the feature, not an implementation detail. It is
what lets the match step be free to guess — it costs nothing to be wrong,
because a human sees the guess before a byte changes. Collapsing the two makes
every earlier ranking decision safety-critical.
