import { describe, expect, test } from "vitest"

import type { MusicBrainzRelease } from "../../tools/musicBrainzApi.js"
import {
  buildProposedTags,
  getReleaseTracksForMatching,
  getTrackArtistCredit,
} from "./buildProposedTags.js"

const buildRelease = (
  overrides: Partial<MusicBrainzRelease> = {},
): MusicBrainzRelease => ({
  artistCredit: [
    {
      artistId: "artist-1",
      joinPhrase: "",
      name: "Public Enemy",
    },
  ],
  artistId: "artist-1",
  barcode: "",
  country: "US",
  date: "1988-06-28",
  folksonomyTags: [],
  formats: ["CD"],
  genres: [{ count: 10, name: "hip hop" }],
  isMultiArtist: false,
  labels: ["Def Jam"],
  media: [
    {
      discNumber: 1,
      format: "CD",
      trackCount: 2,
      tracks: [
        {
          artistCredit: [
            {
              artistId: "artist-1",
              joinPhrase: "",
              name: "Public Enemy",
            },
          ],
          lengthMilliseconds: 210_000,
          position: 1,
          recordingId: "recording-1",
          title: "Bring the Noise",
        },
        {
          artistCredit: [
            {
              artistId: "artist-2",
              joinPhrase: "",
              name: "Chuck D",
            },
          ],
          lengthMilliseconds: 180_000,
          position: 2,
          recordingId: "recording-2",
          title: "Don't Believe the Hype",
        },
      ],
    },
  ],
  primaryType: "Album",
  releaseGroupId: "release-group-1",
  releaseId: "release-1",
  searchScore: 100,
  secondaryTypes: [],
  title: "It Takes a Nation of Millions",
  trackCount: 2,
  ...overrides,
})

describe(getReleaseTracksForMatching.name, () => {
  test("flattens every medium and carries that medium's own track count", () => {
    const release = buildRelease({
      media: [
        {
          discNumber: 1,
          format: "CD",
          trackCount: 12,
          tracks: [
            {
              artistCredit: [],
              lengthMilliseconds: 100,
              position: 1,
              recordingId: "r1",
              title: "One",
            },
          ],
        },
        {
          discNumber: 2,
          format: "CD",
          trackCount: 9,
          tracks: [
            {
              artistCredit: [],
              lengthMilliseconds: 100,
              position: 1,
              recordingId: "r2",
              title: "Two",
            },
          ],
        },
      ],
    })

    expect(
      getReleaseTracksForMatching(release).map((track) => [
        track.discNumber,
        track.totalTracksOnMedium,
      ]),
    ).toEqual([
      [1, 12],
      [2, 9],
    ])
  })
})

describe(buildProposedTags.name, () => {
  test("maps a release and its track onto the tag set the review table diffs", () => {
    const release = buildRelease()
    const track = getReleaseTracksForMatching(release)[0]

    expect(
      buildProposedTags({ release, track }),
    ).toMatchObject({
      album: "It Takes a Nation of Millions",
      albumArtist: "Public Enemy",
      artist: "Public Enemy",
      date: "1988-06-28",
      discNumber: 1,
      genres: ["hip hop"],
      musicBrainzRecordingId: "recording-1",
      musicBrainzReleaseId: "release-1",
      title: "Bring the Noise",
      totalDiscs: 1,
      totalTracks: 2,
      trackNumber: 1,
    })
  })

  test("a track credited to somebody else keeps its own artist, and the album artist does not move", () => {
    const release = buildRelease()
    const track = getReleaseTracksForMatching(release)[1]

    const tags = buildProposedTags({
      release,
      track,
      trackArtistCredit: getTrackArtistCredit({
        release,
        track,
      }),
    })

    expect(tags.artist).toBe("Chuck D")
    expect(tags.albumArtist).toBe("Public Enemy")
    expect(tags.musicBrainzArtistId).toBe("artist-2")
    expect(tags.musicBrainzAlbumArtistId).toBe("artist-1")
  })

  test("totalTracks is the medium's count, not the release's, so disc 2 does not read the total", () => {
    const release = buildRelease({
      media: [
        {
          discNumber: 1,
          format: "CD",
          trackCount: 12,
          tracks: [
            {
              artistCredit: [],
              lengthMilliseconds: 100,
              position: 1,
              recordingId: "r1",
              title: "One",
            },
          ],
        },
        {
          discNumber: 2,
          format: "CD",
          trackCount: 9,
          tracks: [
            {
              artistCredit: [],
              lengthMilliseconds: 100,
              position: 1,
              recordingId: "r2",
              title: "Two",
            },
          ],
        },
      ],
      trackCount: 21,
    })
    const discTwoTrack =
      getReleaseTracksForMatching(release)[1]

    expect(
      buildProposedTags({ release, track: discTwoTrack }),
    ).toMatchObject({
      discNumber: 2,
      totalDiscs: 2,
      totalTracks: 9,
    })
  })

  test("the compilation flag follows the secondary type, not the multi-artist heuristic", () => {
    expect(
      buildProposedTags({
        release: buildRelease({ isMultiArtist: true }),
        track: getReleaseTracksForMatching(
          buildRelease(),
        )[0],
      }).isCompilation,
    ).toBe(false)

    expect(
      buildProposedTags({
        release: buildRelease({
          secondaryTypes: ["Compilation"],
        }),
        track: getReleaseTracksForMatching(
          buildRelease(),
        )[0],
      }).isCompilation,
    ).toBe(true)
  })

  test("the four excluded folksonomy tags never reach the genres field", () => {
    expect(
      buildProposedTags({
        release: buildRelease({
          folksonomyTags: [
            { count: 40, name: "owned" },
            { count: 40, name: "seen live" },
          ],
          genres: [{ count: 40, name: "hip hop" }],
        }),
        track: getReleaseTracksForMatching(
          buildRelease(),
        )[0],
      }).genres,
    ).toEqual(["hip hop"])
  })

  test("a release with no genres at all leaves the field unset rather than empty", () => {
    expect(
      buildProposedTags({
        release: buildRelease({
          folksonomyTags: [],
          genres: [],
        }),
        track: getReleaseTracksForMatching(
          buildRelease(),
        )[0],
      }).genres,
    ).toBeUndefined()
  })
})
