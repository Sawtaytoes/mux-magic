# Automatic music matching tries every provider; specific matchers own release selection

> [!WARNING]
> Superseded by [Discogs is the third music-release matcher](2026-08-28-discogs-is-the-third-music-release-matcher.md).

**Status:** Superseded by [Discogs is the third music-release matcher](2026-08-28-discogs-is-the-third-music-release-matcher.md)
**Date:** 2026-08-28  
**Type:** Product behavior  
**Supersedes:** None  
**Superseded by:** None

## Decision

`matchMusicRelease` is the provider-neutral music matcher. It tries MusicBrainz,
VGMdb and freedb, in that settled order, and combines every candidate into one
review table. A failure from one provider does not prevent the remaining providers
from running.

The three provider-specific commands remain available. They are the surface for a
user who wants to constrain the match to one provider or one release. Any pre-run
release search or direct release selector belongs on those commands, not on the
provider-neutral command.

A provider-specific field must match the provider's actual capability. The UI must
not pretend that freedb's disc-query protocol can search by album name, and it must
not derive a VGMdb album ID from a CDDB category number. VGMdb's canonical album ID
comes from the `EXTD=https://vgmdb.net/album/<id>` field in the read response.

## Context

The first music implementation exposed MusicBrainz, VGMdb and freedb only as three
separate commands. That forced the user to build and run three steps for the normal
"find this album wherever it exists" case. Those cards also lacked the lookup flow
used by AniDB and DVDCompare commands.

The live album in this conversation exposed a second defect. VGMdb's CDDB query
returned category `Soundtrack67816`, while its xmcd read response pointed to canonical
album `57899`. The implementation treated `67816` as the album ID even though the
provider did not.

## Why

The provider-neutral command makes the common workflow one step and preserves the
existing provider order. Combining candidates retains the review gate; it does not
turn matching into an unattended write.

Keeping release selection on provider-specific commands makes the user's intent
explicit and keeps the automatic command free of contradictory provider IDs.

Reading the VGMdb ID from `EXTD` gives links and selections the same identity that the
VGMdb website uses.

## Evidence

User, T3 Code chat `t3code-97938242`:

> "I understand we have the ability to do MusicBrainz, VGMdb, and FreeDB, but it should also have an auto one where it just tries all 3 as well. For the ones that define which is which, I think those ones should be where we need to lookup the album by name to find a possible match."

Live VGMdb CDDB response for the supplied album:

- Query category: `Soundtrack67816`
- Read-response extended data: `EXTD=https://vgmdb.net/album/57899`

## What we rejected — DO NOT revert to this

- Do not require three sequence steps for the normal automatic match.
- Do not stop after the first provider returns candidates; "auto" means all three are
  tried and their candidates are reviewed together.
- Do not put provider-specific release IDs on `matchMusicRelease`.
- Do not treat the numeric tail of a VGMdb CDDB category as a VGMdb album ID.
- Do not claim an album-name search exists when a provider only supports disc queries.
