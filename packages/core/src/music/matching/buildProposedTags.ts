import {
  joinArtistCredit,
  type MusicBrainzArtistCreditPart,
  type MusicBrainzGenre,
  type MusicBrainzRelease,
  selectGenres,
} from "../../tools/musicBrainzApi.js"
import type { AudioTags } from "../tags/audioTagFields.js"
import type { ReleaseTrackForMatching } from "./matchReleaseTracksToFiles.js"

// A MusicBrainz release plus the track a file matched, turned into the tag
// set the review table diffs against the file's current tags. Nothing here
// touches a file — the modal shows this, the user edits it, and only then
// does `writeAudioTags` see it.
//
// `docs/picard-parity.md` §5 is the specification. The settings that shape
// this function are `standardize_artists=true` (so the release's artist
// credit wins over the credited-as name), `use_genres=true` with
// `max_genres=5` / `min_genre_usage=90`, and `join_genres` empty — genres
// stay a multi-value tag, never one joined string.

// Picard's `compilation` flag follows the secondary type, not the
// multi-artist heuristic. A two-artist split single is multi-artist and is
// not a compilation.
export const COMPILATION_SECONDARY_TYPE = "compilation"

const isCompilationRelease = (
  release: MusicBrainzRelease,
) =>
  release.secondaryTypes.some(
    (secondaryType) =>
      secondaryType.trim().toLowerCase() ===
      COMPILATION_SECONDARY_TYPE,
  )

const getFirstArtistId = (
  artistCredit: MusicBrainzArtistCreditPart[],
) => artistCredit.at(0)?.artistId

// The track's own credit when it has one, the release's otherwise. On a
// single-artist album every track repeats the release credit, and on a
// compilation only the track credit is right.
const resolveTrackArtist = ({
  release,
  trackArtistCredit,
}: {
  release: MusicBrainzRelease
  trackArtistCredit?: MusicBrainzArtistCreditPart[]
}) =>
  trackArtistCredit !== undefined &&
  trackArtistCredit.length > 0
    ? joinArtistCredit(trackArtistCredit)
    : joinArtistCredit(release.artistCredit)

const undefinedWhenEmpty = (value: string) =>
  value.trim().length > 0 ? value : undefined

const undefinedWhenNotPositive = (
  value: number | undefined,
) =>
  typeof value === "number" && value > 0 ? value : undefined

export const buildProposedTags = ({
  artistGenres = [],
  release,
  track,
  trackArtistCredit,
}: {
  artistGenres?: MusicBrainzGenre[]
  release: MusicBrainzRelease
  track: ReleaseTrackForMatching
  trackArtistCredit?: MusicBrainzArtistCreditPart[]
}): AudioTags => ({
  album: undefinedWhenEmpty(release.title),
  albumArtist: undefinedWhenEmpty(
    joinArtistCredit(release.artistCredit),
  ),
  artist: undefinedWhenEmpty(
    resolveTrackArtist({ release, trackArtistCredit }),
  ),
  date: undefinedWhenEmpty(release.date),
  discNumber: undefinedWhenNotPositive(track.discNumber),
  genres: ((genreNames: string[]) =>
    genreNames.length > 0 ? genreNames : undefined)(
    selectGenres({
      artistGenres,
      folksonomyTags: release.folksonomyTags,
      releaseGenres: release.genres,
    }),
  ),
  isCompilation: isCompilationRelease(release),
  musicBrainzAlbumArtistId: getFirstArtistId(
    release.artistCredit,
  ),
  musicBrainzArtistId:
    trackArtistCredit !== undefined &&
    trackArtistCredit.length > 0
      ? getFirstArtistId(trackArtistCredit)
      : getFirstArtistId(release.artistCredit),
  musicBrainzRecordingId: track.recordingId,
  musicBrainzReleaseGroupId: undefinedWhenEmpty(
    release.releaseGroupId,
  ),
  musicBrainzReleaseId: undefinedWhenEmpty(
    release.releaseId,
  ),
  title: undefinedWhenEmpty(track.title),
  totalDiscs: undefinedWhenNotPositive(
    release.media.length,
  ),
  totalTracks: undefinedWhenNotPositive(
    track.totalTracksOnMedium,
  ),
  trackNumber: undefinedWhenNotPositive(track.position),
})

// The flat track list `matchReleaseTracksToFiles` takes, built from a
// release's media. `totalTracksOnMedium` rides along because `totalTracks`
// is per-disc — on a 2-disc release with 12 and 9 tracks, every disc-2 file
// must read 9, not 21.
export const getReleaseTracksForMatching = (
  release: MusicBrainzRelease,
): ReleaseTrackForMatching[] =>
  release.media.flatMap((medium) =>
    medium.tracks.map((track) => ({
      discNumber: medium.discNumber,
      lengthMilliseconds: track.lengthMilliseconds,
      position: track.position,
      recordingId: track.recordingId,
      title: track.title,
      totalTracksOnMedium: medium.trackCount,
    })),
  )

export const getTrackArtistCredit = ({
  release,
  track,
}: {
  release: MusicBrainzRelease
  track: ReleaseTrackForMatching
}) =>
  release.media
    .find(
      (medium) => medium.discNumber === track.discNumber,
    )
    ?.tracks.find(
      (mediumTrack) =>
        mediumTrack.position === track.position,
    )?.artistCredit
