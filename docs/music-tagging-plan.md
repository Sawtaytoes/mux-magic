# Music tagging and ingest live inside Mux-Magic — the build plan

*Status: plan, not started. Owner-settled 2026-08-24.*

The goal is to stop using **MP3Tag + Picard** as a pair and get one surface that does
what both do: MusicBrainz matching, VGMdb matching, AcoustID fingerprinting, bulk tag
read/edit/write, duplicate detection, a library view, and correct naming/moving into the
music library.

The app that gets this is **Mux-Magic**, not a new app.

**Read [the Picard parity doc](picard-parity.md)
beside this one.** It records the naming rules, the multi-disc convention and every default,
read from the owner's live `Picard.ini` — that is the specification the defaults must meet.

> **This is the public copy.** Every path and every key below is a placeholder or a fake.
> The real roots, hosts and database files stay in the private `agentic` workspace and
> reach the app only as environment variables — see [§10](#10-where-the-real-paths-live).
> Nothing personal goes in this repository, not even in a docs file.

---

## 1. The decision, and why it is not a new app

A separate app was proposed and named (*Libretto*). It was rejected. The owner's
reasoning, plus what the Mux-Magic source actually shows:

**Mux-Magic is already an ingest app, not a muxing app.** It names special features,
compares releases, renames files, converts audio to FLAC, and runs the whole thing as
sequences. Music ingest is the same job on a different file type.

**The interactive editor already exists there.** `SmartMatchModal` (the "Fix Unnamed"
table that opens after a `nameSpecialFeaturesDvdCompareTmdb` run) is a bulk metadata
editor already:

- one row per file,
- server-ranked candidates per row with a confidence score,
- a per-row override picker,
- a per-row free-text custom value,
- a per-row preview button,
- a per-row include checkbox, low-confidence rows unchecked by default,
- **Apply** → a batch of `POST /files/rename`, with per-row success and failure state.

The music version of that table is the same component with more columns. This is the
single strongest argument for Mux-Magic: the hard UI shape is built and has Storybook
stories, tests and an `.mdx` behaviour spec.

**The dependency cost is much smaller than it looks.** Mux-Magic does not use vendor
SDKs. `searchMovieDb.ts` is a hand-written `fetch` client with a locally-declared
response subset. `searchDvdCompare.ts` is a Playwright + jsdom scraper. MusicBrainz is
the first pattern; VGMdb is the second. Neither adds an npm package. AcoustID needs the
`fpcalc` binary, and Mux-Magic already spawns `ffmpeg`, `mkvtoolnix`, `mediainfo` and
`makemkvcon` and documents that pattern in `docs/agents/external-tools.md`. It even
already ships a Python venv (`audio-offset-finder`), so a Python-side tag tool is not a
new class of dependency either.

**Net new dependencies: one npm package (a tag writer) and one apt/binary package
(`fpcalc`).** See [§6](#6-dependencies-exactly-what-is-new).

**What was given up by not building a separate app:** a place to put a persistent library
catalog. That is answered in [§4](#4-no-library-catalog--read-the-catalogs-that-exist).

---

## 2. Everything goes through the sequencer

**Settled 2026-08-24:** the tag editor and the library browser are reached **only**
through a sequence run. There is no free-standing "browse the filesystem and edit tags"
page in the first version.

This follows the existing model exactly: every Mux-Magic capability is a command, and a
command may open an interactive modal when it finishes. `nameSpecialFeaturesDvdCompareTmdb`
→ `SmartMatchModal` is the precedent, and it is currently the *only* direct-edit surface
in the app. Music tagging becomes the second one, built the same way.

Consequences:

- The user points a sequence at a folder, runs it, and the tag table opens with matches
  already ranked. The user reviews, overrides, applies.
- Nothing edits a file outside a job. Every write is attributable to a job id and step id.
- Sequence templates become reusable ingest recipes, shareable as YAML and via the URL
  query string, the same as today.

**Deferred, not rejected:** a direct-browse tag page. `FileExplorerModal` already exists
and could open the table with no job behind it. Revisit after the sequenced flow is in use.

**Related gap the owner raised:** Mux-Magic has **no general file/folder renamer** —
renaming is only ever a side effect of a naming command. A standalone
`renameFilesAndFolders` command is worth adding, and the music work needs most of its
parts anyway (path templating, collision checks, dry-run preview). Tracked as a separate
item in [§8](#8-phases).

---

## 3. Provider cache — one SQLite cache for every provider, not just music

The owner's call, and it is wider than music: **Mux-Magic should cache external provider
responses in SQLite, for the providers it already has.**

- **DVDCompare goes down often.** A cached response is the difference between a failed run
  and a slow one.
- **AniDB rate-limits and dislikes repeat requests for the same show.** Caching is close to
  a requirement of using it politely.
- **MusicBrainz asks for one request per second** and a descriptive `User-Agent`. A cache is
  the normal way to stay inside that.
- **VGMdb has no official API**, so every lookup is a scrape. Scraping the same album twice
  is waste and risk.

Design sketch:

- One database file, `provider-cache.sqlite`, beside the existing template store.
- One table keyed by `(provider, requestKey)` holding the raw response body, a fetch
  timestamp, and an ETag when the provider gives one.
- Per-provider TTL. Album metadata is close to immutable, so the TTL is long (weeks).
- **The cache is deletable.** Nothing in it is a book of record. Deleting the file must
  only cost time, never data.
- It is a **cache**, not a catalog. It never holds the state of the music library.

This is the first database in Mux-Magic. That is acceptable because it is disposable; a
library catalog would not be, which is the next section.

---

## 4. No library catalog — read the catalogs that exist

The library browser and the duplicate pass need to know what is in the library. Mux-Magic
will **not** build and maintain its own index of it.

**Music Assistant and Plex already index this library**, and both keep a SQLite database
with tracks, albums, artists, durations, file paths and provider ids. Rebuilding that in
Mux-Magic means a second index that can disagree with the first two.

Rules for this:

- **Read-only. Always.** Mux-Magic opens these databases read-only (`file:…?mode=ro`, or a
  copy) and never writes to them. They belong to other apps.
- **Treat the schema as unstable.** Neither app promises its schema. Every read is wrapped
  and every failure degrades to "no library data", not a crashed job.
- **Falling back to a scan is allowed.** When no external catalog is reachable, a
  `scanAudioFiles` command walks the directory and produces the same shape in memory, for
  that run only.
- The owner accepts the third-party dependency here explicitly: *"Mux-Magic is all about
  sequence execution of 3rd-party tooling."*

Open item: confirm which of the two databases is the better read, and whether Music
Assistant's API is a better door than its database file. See [§9](#9-open-questions).

---

## 5. The commands and the surfaces

### Commands (all sequenceable, `packages/core/src/app-commands/`)

| Command | Job |
| --- | --- |
| `scanAudioFiles` | Walk a folder. Read existing tags, duration, codec, bit depth, sample rate. Emits the row set every later step consumes. |
| `fingerprintAudioFiles` | Run `fpcalc` per file, query AcoustID, attach recording ids and scores. |
| `matchMusicBrainzRelease` | Cluster files into an album, search MusicBrainz, rank candidate releases, attach ranked candidates per file. |
| `matchVgmdbRelease` | The same for VGMdb — game and anime soundtracks that MusicBrainz covers badly. This is the MP3Tag script being replaced. |
| `writeAudioTags` | Write the accepted tag set to the files. The only step that mutates tags. |
| `renameAndMoveAudioFiles` | Apply the naming template and move into the library tree. |
| `findDuplicateAudioFiles` | Compare candidates by fingerprint, by tags, and by decoded audio; rank which copy is better by codec, bit depth, sample rate and source. |
| `renameFilesAndFolders` | The general renamer Mux-Magic lacks today. Not music-specific. |

### Interactive surfaces (all opened by a command run)

**`TagMatchModal`** — the music `SmartMatchModal`. Rows are files. Each row carries ranked
release/recording candidates with confidence, an override picker, an editable value, an
include checkbox, and a play button (`VideoPreviewModal` already handles playback and can
be pointed at audio). Apply posts the batch.

Difference from Smart Match, and the real design work: a music row commits **many fields**
(title, artist, album, album artist, track number, disc number, date, genre, cover art),
not one filename. The table needs a per-field diff — old value against proposed value —
and bulk column actions ("apply this album artist to all rows"), which is the MP3Tag
behaviour being replaced.

**Duplicate compare modal** — the owner's suggestion: reuse the same prompt-modal shape for
deduplication. Rows are duplicate groups; each row shows the copies side by side with the
facts that decide it (codec, bit depth, sample rate, size, path, fingerprint match), the
recommended keep pre-selected, and the user confirming or overriding. **Nothing deletes
without a confirmed row** — the standing rule against blind deletion carries over
whole.

**Library browser** — a read view of the library rows, opened by the scan/browse command.
Grid layout, per the workspace rule that lists of cards are a grid.

### Writing back to MusicBrainz and AcoustID

The owner asked for this directly: *"We can also add functionality to write stuff to
MusicBrainz over the API."* It is worth building, and the honest answer is that **the write
surface is narrow, and the interesting half is not an API at all.**

**What the MusicBrainz web service actually accepts** (checked against the API documentation
2026-08-24, not from memory):

| Submission | Endpoint |
| --- | --- |
| Tags and genres | `POST /ws/2/tag` |
| Ratings | `POST /ws/2/rating` |
| Barcodes | `POST /ws/2/release/` |
| ISRCs | `POST /ws/2/recording/` |
| Collections | `PUT` / `DELETE /ws/2/collection/<gid>/<entity-type>` |

⚠️ **That is the whole list.** The web service **cannot create or edit a release, a recording
or an artist.** The documentation says to use the website for most additions. So "fix this
release's track title from the tagger" is not an API call and never will be.

**What the missing half needs instead — and we already built it once.** A release that is not
in MusicBrainz has to be added through a **seeded web form**: the app builds a self-submitting
HTML form and the owner completes it in his browser, logged in as himself. A working
implementation of exactly this already exists in the private workspace, written in July
2026. **Port that, do not re-derive it.** It is the highest-value part of this
feature, because the case that actually blocks ingest is an indie or Bandcamp album that
MusicBrainz has never heard of.

**AcoustID submission is separate, and simpler.** Fingerprints go back to AcoustID, which is
what Picard does today (`save_acoustid_fingerprints=true`). This is the most valuable write of
the lot: it improves the database the tagger reads from, and every correctly-matched file is a
free contribution.

⚠️ **Two keys, and they are not interchangeable.** Verified against the live AcoustID API on
2026-08-24: the **application key** is the `client=` parameter on `/v2/lookup`, and the
**account key** from the AcoustID user page is what submits. Sending the account key as
`client=` returns AcoustID error 4, *"invalid API key"*. Both are in the root `.env`, as
`ACOUSTID_API_KEY` and `ACOUSTID_USER_API_KEY`.

**Rules for anything that writes outward:**

1. **Never submit automatically.** These are public database edits made under the owner's
   account, and a wrong one is visible to everybody and has to be undone by hand. Every
   submission is an explicit, reviewed action in the modal — the same shape as Apply.
2. **Authenticate with OAuth.** `MUSICBRAINZ_OAUTH_CLIENT_ID` and
   `MUSICBRAINZ_OAUTH_CLIENT_SECRET` are already in the root `.env`.
3. **One request per second, and a descriptive `User-Agent`.** MusicBrainz blocks IP addresses
   over this, and the address it would block is the household's.
4. **Every `POST` needs the `client=application-version` parameter.**

---

## 6. Dependencies — exactly what is new

| Need | Answer | New dependency? |
| --- | --- | --- |
| Read tags | `music-metadata` (npm), or the tag library below | 1 npm package |
| **Write** tags | **`node-taglib-sharp`** — provenance checked 2026-08-24, see below | 1 npm package |
| Fingerprint | `fpcalc` from Chromaprint, `apt-get install libchromaprint-tools` in the runtime stage | 1 apt package |
| AcoustID | Hand-written `fetch` client, `searchMovieDb.ts` pattern | none |
| MusicBrainz | Hand-written `fetch` client. 1 request/second, descriptive `User-Agent` required | none |
| Cover Art Archive | Hand-written `fetch` client | none |
| VGMdb | Scraper, `searchDvdCompare.ts` pattern (Playwright + jsdom, both already dependencies) | none |
| Provider cache | `node:sqlite` (built into Node 26; the runtime image is `node:26-trixie-slim`) | none |
| Audio conversion | `ffmpeg`, already in the image and already wrapped | none |

**Do not add a MusicBrainz SDK, an AcoustID SDK, or a VGMdb client package.** The house
pattern is a hand-written client with a locally-declared response subset, so that
unit tests can use synthetic inputs.

### `node-taglib-sharp` provenance — checked 2026-08-24

The owner's rule: **prefer 100 % npm dependencies, because they are far easier to maintain.**
`ffmpeg` and `audio-offset-finder` are tolerated because nothing replaces them. A new Python
dependency for tag writing is not in that class, so `mutagen` is the fallback and not the plan.

Measured from the npm registry and the GitHub API, not from a summary:

| Fact | Value |
| --- | --- |
| Author | Benjamin Russell (`benrr101`), Austin TX, Microsoft |
| Repository | `benrr101/node-taglib-sharp`, created 2019, **not** archived |
| What it is | A port of `mono/taglib-sharp`, the long-established .NET tagging library |
| Latest | 6.0.3, published 2026-04-12; last commit 2026-08-09 |
| Runtime dependencies | `iconv-lite`, `os-locale`, `uuid` — all pure JavaScript. **`iconv-lite` is already a Mux-Magic dependency.** |
| Install scripts | **none** — no `install`, `preinstall` or `postinstall` |
| Native code | none |
| Writes | ID3v2 (MP3, AAC, AIFF, WAV), Xiph comments (FLAC, OGG, Opus), MP4/M4A. Matroska is read-only. |

Provenance is clean and the Chinese-origin constraint does not bite.

⚠️ **One flag, and it is not a blocker: the licence is LGPL-2.1-or-later.** Mux-Magic declares
no licence today, so nothing is breached now. But `build:server-bundle` uses `esbuild --bundle`,
which links the library into one file — the case where LGPL asks that a user be able to relink
against a modified copy. Decide this if and when Mux-Magic takes a licence. Alternative if it
ever matters: **`taglib-wasm`** (MIT wrapper, actively maintained, WebAssembly, so still 100 %
npm) — though the underlying TagLib is itself LGPL, so the swap may not change the answer.
Read-only metadata can come from `music-metadata` (MIT), which is what everything else uses.

### VGMdb provenance

VGMdb has no official API. There is a widely-used third-party API mirror. **Confirm its
origin before adopting it** — the workspace bans Chinese-origin software, and unclear
origin is off-limits until confirmed. If the origin cannot be confirmed, scrape VGMdb
directly with the DVDCompare pattern. The safest default is to scrape it ourselves.

---

## 7. Configuration, keys and paths

Every credential is an environment variable, read through the existing `loadEnv.ts`.
**Never a committed value.** Example block for the public docs — these values are fake:

```sh
# All example values below are fake.
ACOUSTID_API_KEY=aBcDeF1234
MUSICBRAINZ_USER_AGENT="mux-magic/1.0.0 ( https://example.com/contact )"
MUSIC_LIBRARY_PATH=/media/music
MUSIC_INBOX_PATH=/media/downloads/music
MUSIC_UNSORTED_PATH=/media/uncategorized-music
MUSIC_ASSISTANT_LIBRARY_DB=/media/config/music-assistant/library.db
```

Three roots are mapped into the app, and the public docs name them only as the three
placeholders above:

1. **Inbox** — freshly downloaded music, not yet processed.
2. **Unsorted** — the older uncategorized pile.
3. **Library** — the destination tree, the book of record.

The real values for all six variables live in the root `.env` and in
[§10](#10-real-environment-map-agentic-only-do-not-copy-into-mux-magic).

---

## 8. Phases

**Phase 0 — foundations.** `provider-cache.sqlite` plus the cache wrapper, retro-fitted to
DVDCompare and AniDB first. This ships value before any music code exists and proves the
cache shape against providers we already know.

**Phase 1 — read.** `scanAudioFiles` and the tag reader. A command that walks a folder and
shows what is there. No writes.

**Phase 2 — match.** MusicBrainz client, then `matchMusicBrainzRelease` with ranking that
reuses the NSF scorer's shape (`rankCandidates.ts`).

**Phase 3 — the table.** `TagMatchModal`, ported from `SmartMatchModal`, with the per-field
diff and the bulk column actions. Storybook stories and an `.mdx` spec, per repo rules.

**Phase 4 — write.** `writeAudioTags`, behind the modal's Apply. First point at which a
file changes. Needs a dry-run mode and a per-row failure state.

**Phase 5 — fingerprint.** `fpcalc` in the image, AcoustID client,
`fingerprintAudioFiles`. This is what identifies untagged and mistagged files.

**Phase 6 — VGMdb.** The scraper and `matchVgmdbRelease`. Replaces the MP3Tag script.

**Phase 7 — name and move.** `renameAndMoveAudioFiles`, plus the general
`renameFilesAndFolders` command. ⚠️ **This phase is bigger than it looks.** The naming rules
are conditional — the disc prefix appears only on multi-disc releases and gains a digit past
nine discs, the album folder disappears when there is no album artist, and the track artist
appears only on a multi-artist release. A flat `{albumartist}/{album}/{track} {title}` template
cannot express them. Build against the worked-examples table in
[the parity doc](picard-parity.md#worked-examples--these-are-the-acceptance-tests),
and use the acceptance test in its §10: re-running over an album already filed correctly must
produce **zero** renames, moves and tag changes.

**Phase 8 — library and duplicates.** Read the external catalog, the library browser view,
`findDuplicateAudioFiles` and the duplicate compare modal.

**Phase 9 — write back.** AcoustID fingerprint submission first (it is the simplest and the
most useful), then the five MusicBrainz `ws/2` submissions, then the ported seeded-release
form. Every one of them explicit and reviewed, never automatic. See
[§5](#writing-back-to-musicbrainz-and-acoustid).

MP3Tag and Picard can be dropped after Phase 7 for tagging, and after Phase 8 for the
whole workflow. Phase 9 is the part that goes past what either of them does.

---

## 9. Open questions

1. ~~**Which tag writer?**~~ **Settled 2026-08-24: `node-taglib-sharp`**, on the owner's
   "100 % npm if we can" rule plus a clean provenance check ([§6](#node-taglib-sharp-provenance--checked-2026-08-24)).
   What remains is the **proving test**. A real-file corpus is chosen and is named in the
   private workspace, not here — 158 FLAC tracks, 16-bit/44.1, source already verified.
   FLAC is therefore proven against real files; **MP3, M4A and Opus still need a fixture
   each**, and those fixtures are generated with `ffmpeg` at test time, never taken from
   the library.
2. **Music Assistant database, or its API?** The database is a direct read and needs no
   service to be up. The API is a supported contract. Check whether the API exposes file
   paths, which is the field that matters here.
3. **Plex as well, or Music Assistant only?** Only worth both if they disagree usefully.
4. **VGMdb third-party API origin** — confirm, or scrape directly. See [§6](#vgmdb-provenance).
5. **Cover art** — embed, write `cover.jpg` beside the files, or both. Match whatever the
   library already does.
6. **Where does the duplicate work overlap the existing ingest scripts?** The private
   workspace has a working fingerprint and comparison toolkit in Python. Decide whether
   Phase 8 ports it or calls it.

---

## 10. Where the real paths live

The three library roots, the Music Assistant database path, the Plex database path and
the proving corpus are **deliberately not in this repository**. They are personal detail
and this repo is publishable. They live in the `agentic` workspace, in the "Real
environment map" section of the same plan, and they reach the app only as the environment
variables listed in [§7](#7-configuration-keys-and-paths).

⚠️ **No test fixture is copied out of the music library.** MP3, M4A and Opus fixtures are
generated with `ffmpeg` at test time, into a temporary directory.
