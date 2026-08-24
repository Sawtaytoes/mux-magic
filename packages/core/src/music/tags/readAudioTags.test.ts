import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, expect, test, vi } from "vitest"
import {
  generateAudioFixture,
  getIsFfmpegAvailable,
} from "../fixtures/generateAudioFixture.js"
import { readAudioTags } from "./readAudioTags.js"

vi.unmock("node:fs")
vi.unmock("node:fs/promises")
vi.unmock("../../cli-spawn-operations/runFfmpeg.js")
vi.unmock("../../cli-spawn-operations/treeKillChild.js")

const isFfmpegAvailable = await getIsFfmpegAvailable()
const isFfmpegMissing = !isFfmpegAvailable

if (isFfmpegMissing) {
  console.warn(
    "readAudioTags.test.ts: ffmpeg is not on PATH, so every fixture-backed test is skipped.",
  )
}

const fixtureDirectoryPath = await mkdtemp(
  join(tmpdir(), "read-audio-tags-"),
)

afterAll(async () => {
  await rm(fixtureDirectoryPath, {
    force: true,
    recursive: true,
  })
})

const getFixtureFilePath = (fileName: string) =>
  join(fixtureDirectoryPath, fileName)

test.skipIf(isFfmpegMissing)(
  "reads the common tags and the file info from a generated FLAC",
  async () => {
    const filePath = getFixtureFilePath("common.flac")

    await generateAudioFixture({
      format: "flac",
      outputPath: filePath,
      tags: {
        ALBUM: "Generated Album",
        ALBUMARTIST: "Generated Album Artist",
        ARTIST: "Generated Artist",
        COMPOSER: "Generated Composer",
        DATE: "2019-05-17",
        GENRE: "Electronic",
        TITLE: "Generated Title",
        TRACKNUMBER: "3",
      },
    })

    const { info, tags } = await readAudioTags(filePath)

    expect(tags.title).toBe("Generated Title")
    expect(tags.artist).toBe("Generated Artist")
    expect(tags.albumArtist).toBe("Generated Album Artist")
    expect(tags.album).toBe("Generated Album")
    expect(tags.composer).toBe("Generated Composer")
    expect(tags.date).toBe("2019-05-17")
    expect(tags.genres).toEqual(["Electronic"])
    expect(tags.trackNumber).toBe(3)

    expect(info.filePath).toBe(filePath)
    expect(info.codec).toBe("FLAC")
    expect(info.sampleRate).toBe(44100)
    expect(info.channelCount).toBe(1)
    expect(info.bitDepth).toBe(16)
    expect(info.fileSizeBytes).toBeGreaterThan(0)
    expect(info.durationSeconds).toBeGreaterThan(0)
    expect(info.hasEmbeddedCoverArt).toBe(false)
  },
)

test.skipIf(isFfmpegMissing)(
  "leaves every missing tag undefined instead of throwing",
  async () => {
    const filePath = getFixtureFilePath("untagged.opus")

    await generateAudioFixture({
      format: "opus",
      outputPath: filePath,
    })

    const { info, tags } = await readAudioTags(filePath)

    expect(tags.title).toBeUndefined()
    expect(tags.artist).toBeUndefined()
    expect(tags.album).toBeUndefined()
    expect(tags.genres).toBeUndefined()
    expect(tags.trackNumber).toBeUndefined()
    expect(tags.musicBrainzReleaseId).toBeUndefined()
    expect(tags.acoustIdFingerprint).toBeUndefined()
    expect(info.fileSizeBytes).toBeGreaterThan(0)
  },
)

test.skipIf(isFfmpegMissing)(
  "reads the MusicBrainz and AcoustID values out of Xiph comments",
  async () => {
    const filePath = getFixtureFilePath("xiph-ids.flac")

    await generateAudioFixture({
      format: "flac",
      outputPath: filePath,
      tags: {
        ACOUSTID_FINGERPRINT: "AQADtEmSREkSJUmSJEmS",
        ACOUSTID_ID: "11111111-2222-3333-4444-555555555555",
        MUSICBRAINZ_ALBUMARTISTID:
          "aaaaaaaa-1111-2222-3333-444444444444",
        MUSICBRAINZ_ALBUMID:
          "bbbbbbbb-1111-2222-3333-444444444444",
        MUSICBRAINZ_ARTISTID:
          "cccccccc-1111-2222-3333-444444444444",
        MUSICBRAINZ_RELEASEGROUPID:
          "dddddddd-1111-2222-3333-444444444444",
        MUSICBRAINZ_TRACKID:
          "eeeeeeee-1111-2222-3333-444444444444",
      },
    })

    const { tags } = await readAudioTags(filePath)

    expect(tags.acoustIdFingerprint).toBe(
      "AQADtEmSREkSJUmSJEmS",
    )
    expect(tags.acoustIdId).toBe(
      "11111111-2222-3333-4444-555555555555",
    )
    expect(tags.musicBrainzAlbumArtistId).toBe(
      "aaaaaaaa-1111-2222-3333-444444444444",
    )
    expect(tags.musicBrainzReleaseId).toBe(
      "bbbbbbbb-1111-2222-3333-444444444444",
    )
    expect(tags.musicBrainzArtistId).toBe(
      "cccccccc-1111-2222-3333-444444444444",
    )
    expect(tags.musicBrainzReleaseGroupId).toBe(
      "dddddddd-1111-2222-3333-444444444444",
    )
    expect(tags.musicBrainzRecordingId).toBe(
      "eeeeeeee-1111-2222-3333-444444444444",
    )
  },
)

test.skipIf(isFfmpegMissing)(
  "reads the MusicBrainz and AcoustID values out of ID3v2 TXXX frames",
  async () => {
    const filePath = getFixtureFilePath("id3-ids.mp3")

    await generateAudioFixture({
      format: "mp3",
      outputPath: filePath,
      tags: {
        "Acoustid Fingerprint": "AQADtEmSREkSJUmSJEmS",
        "Acoustid Id":
          "11111111-2222-3333-4444-555555555555",
        "MusicBrainz Album Artist Id":
          "aaaaaaaa-1111-2222-3333-444444444444",
        "MusicBrainz Album Id":
          "bbbbbbbb-1111-2222-3333-444444444444",
        "MusicBrainz Artist Id":
          "cccccccc-1111-2222-3333-444444444444",
        "MusicBrainz Release Group Id":
          "dddddddd-1111-2222-3333-444444444444",
        "MusicBrainz Track Id":
          "eeeeeeee-1111-2222-3333-444444444444",
      },
    })

    const { tags } = await readAudioTags(filePath)

    expect(tags.acoustIdFingerprint).toBe(
      "AQADtEmSREkSJUmSJEmS",
    )
    expect(tags.acoustIdId).toBe(
      "11111111-2222-3333-4444-555555555555",
    )
    expect(tags.musicBrainzAlbumArtistId).toBe(
      "aaaaaaaa-1111-2222-3333-444444444444",
    )
    expect(tags.musicBrainzReleaseId).toBe(
      "bbbbbbbb-1111-2222-3333-444444444444",
    )
    expect(tags.musicBrainzArtistId).toBe(
      "cccccccc-1111-2222-3333-444444444444",
    )
    expect(tags.musicBrainzReleaseGroupId).toBe(
      "dddddddd-1111-2222-3333-444444444444",
    )
    expect(tags.musicBrainzRecordingId).toBe(
      "eeeeeeee-1111-2222-3333-444444444444",
    )
  },
)

test("rejects with an error naming the file when the file is not audio", async () => {
  const filePath = getFixtureFilePath("not-audio.flac")

  await writeFile(filePath, "this is plain text, not audio")

  await expect(readAudioTags(filePath)).rejects.toThrow(
    `Cannot read audio tags from "${filePath}"`,
  )
})

test("rejects with an error naming the file when the file is missing", async () => {
  const filePath = getFixtureFilePath("missing.flac")

  await expect(readAudioTags(filePath)).rejects.toThrow(
    `Cannot read audio tags from "${filePath}"`,
  )
})
