import { mkdtemp, rm, stat, utimes } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { File, TagTypes } from "node-taglib-sharp"
import { afterAll, expect, test, vi } from "vitest"
import {
  type AudioFixtureFormat,
  generateAudioFixture,
  getIsFfmpegAvailable,
} from "../fixtures/generateAudioFixture.js"
import type { AudioTags } from "./audioTagFields.js"
import { diffAudioTags } from "./diffAudioTags.js"
import { readAudioTags } from "./readAudioTags.js"
import { writeAudioTags } from "./writeAudioTags.js"

vi.unmock("node:fs")
vi.unmock("node:fs/promises")
vi.unmock("../../cli-spawn-operations/runFfmpeg.js")
vi.unmock("../../cli-spawn-operations/treeKillChild.js")

const isFfmpegAvailable = await getIsFfmpegAvailable()
const isFfmpegMissing = !isFfmpegAvailable

if (isFfmpegMissing) {
  console.warn(
    "writeAudioTags.test.ts: ffmpeg is not on PATH, so every fixture-backed test is skipped.",
  )
}

const fixtureDirectoryPath = await mkdtemp(
  join(tmpdir(), "write-audio-tags-"),
)

afterAll(async () => {
  await rm(fixtureDirectoryPath, {
    force: true,
    recursive: true,
  })
})

const getFixtureFilePath = (fileName: string) =>
  join(fixtureDirectoryPath, fileName)

const createFixture = ({
  fileName,
  format,
}: {
  fileName: string
  format: AudioFixtureFormat
}) =>
  generateAudioFixture({
    format,
    outputPath: getFixtureFilePath(fileName),
  })

const fullTags: AudioTags = {
  acoustIdFingerprint: "AQADtEmSREkSJUmSJEmSJEmSJEmSJEmS",
  acoustIdId: "11111111-2222-3333-4444-555555555555",
  album: "Parity Album",
  albumArtist: "Parity Album Artist",
  artist: "Parity Artist",
  comment: "Parity comment",
  composer: "Parity Composer",
  date: "2019-05-17",
  discNumber: 1,
  genres: ["Electronic", "Ambient"],
  isCompilation: true,
  musicBrainzAlbumArtistId:
    "aaaaaaaa-1111-2222-3333-444444444444",
  musicBrainzArtistId:
    "cccccccc-1111-2222-3333-444444444444",
  musicBrainzRecordingId:
    "eeeeeeee-1111-2222-3333-444444444444",
  musicBrainzReleaseGroupId:
    "dddddddd-1111-2222-3333-444444444444",
  musicBrainzReleaseId:
    "bbbbbbbb-1111-2222-3333-444444444444",
  title: "Parity Title",
  totalDiscs: 2,
  totalTracks: 12,
  trackNumber: 3,
}

const roundTripFormats: AudioFixtureFormat[] = [
  "flac",
  "mp3",
  "m4a",
  "opus",
]

roundTripFormats.forEach((format) => {
  test.skipIf(isFfmpegMissing)(
    `round-trips every canonical tag through a ${format} file`,
    async () => {
      const filePath = await createFixture({
        fileName: `round-trip.${format}`,
        format,
      })

      await writeAudioTags({ filePath, tags: fullTags })

      const { tags } = await readAudioTags(filePath)

      expect(tags).toEqual(fullTags)

      const differences = diffAudioTags({
        currentTags: fullTags,
        proposedTags: tags,
      })

      expect(
        differences.filter(
          (difference) =>
            difference.changeType !== "unchanged",
        ),
      ).toEqual([])
    },
  )
})

test.skipIf(isFfmpegMissing)(
  "leaves an existing value alone when its field is absent from the tags object",
  async () => {
    const filePath = await createFixture({
      fileName: "absent-field.flac",
      format: "flac",
    })

    await writeAudioTags({
      filePath,
      tags: {
        artist: "First Artist",
        title: "First Title",
      },
    })

    await writeAudioTags({
      filePath,
      tags: { title: "Second Title" },
    })

    const { tags } = await readAudioTags(filePath)

    expect(tags.title).toBe("Second Title")
    expect(tags.artist).toBe("First Artist")
  },
)

test.skipIf(isFfmpegMissing)(
  "clears a field given an empty string",
  async () => {
    const filePath = await createFixture({
      fileName: "clear-string.flac",
      format: "flac",
    })

    await writeAudioTags({
      filePath,
      tags: {
        artist: "Clearable Artist",
        comment: "Clearable comment",
        title: "Clearable Title",
      },
    })

    await writeAudioTags({
      filePath,
      tags: { artist: "", comment: "" },
    })

    const { tags } = await readAudioTags(filePath)

    expect(tags.artist).toBeUndefined()
    expect(tags.comment).toBeUndefined()
    expect(tags.title).toBe("Clearable Title")
  },
)

test.skipIf(isFfmpegMissing)(
  "clears the genres given an empty array",
  async () => {
    const filePath = await createFixture({
      fileName: "clear-genres.flac",
      format: "flac",
    })

    await writeAudioTags({
      filePath,
      tags: { genres: ["Electronic", "Ambient"] },
    })

    await writeAudioTags({ filePath, tags: { genres: [] } })

    const { tags } = await readAudioTags(filePath)

    expect(tags.genres).toBeUndefined()
  },
)

test.skipIf(isFfmpegMissing)(
  "writes the genres as a multi-value tag",
  async () => {
    const filePath = await createFixture({
      fileName: "multi-genres.flac",
      format: "flac",
    })

    await writeAudioTags({
      filePath,
      tags: { genres: ["Electronic", "Ambient", "Techno"] },
    })

    const { tags } = await readAudioTags(filePath)

    expect(tags.genres).toEqual([
      "Electronic",
      "Ambient",
      "Techno",
    ])
  },
)

test.skipIf(isFfmpegMissing)(
  "preserves the modification time by default",
  async () => {
    const filePath = await createFixture({
      fileName: "preserved-timestamp.flac",
      format: "flac",
    })

    const originalTime = new Date(
      "2019-05-17T12:00:00.000Z",
    )
    await utimes(filePath, originalTime, originalTime)

    await writeAudioTags({
      filePath,
      tags: { title: "Timestamp Title" },
    })

    const fileStats = await stat(filePath)

    expect(fileStats.mtime.getTime()).toBe(
      originalTime.getTime(),
    )
  },
)

test.skipIf(isFfmpegMissing)(
  "lets the modification time move when isTimestampPreserved is false",
  async () => {
    const filePath = await createFixture({
      fileName: "moving-timestamp.flac",
      format: "flac",
    })

    const originalTime = new Date(
      "2019-05-17T12:00:00.000Z",
    )
    await utimes(filePath, originalTime, originalTime)

    await writeAudioTags({
      filePath,
      isTimestampPreserved: false,
      tags: { title: "Timestamp Title" },
    })

    const fileStats = await stat(filePath)

    expect(fileStats.mtime.getTime()).toBeGreaterThan(
      originalTime.getTime(),
    )
  },
)

test.skipIf(isFfmpegMissing)(
  "writes nothing when isDryRun is true",
  async () => {
    const filePath = await createFixture({
      fileName: "dry-run.flac",
      format: "flac",
    })

    await writeAudioTags({
      filePath,
      tags: { title: "Original Title" },
    })

    const fileStatsBefore = await stat(filePath)

    await writeAudioTags({
      filePath,
      isDryRun: true,
      tags: {
        artist: "Dry Run Artist",
        title: "Dry Run Title",
      },
    })

    const { tags } = await readAudioTags(filePath)
    const fileStatsAfter = await stat(filePath)

    expect(tags.title).toBe("Original Title")
    expect(tags.artist).toBeUndefined()
    expect(fileStatsAfter.size).toBe(fileStatsBefore.size)
  },
)

test.skipIf(isFfmpegMissing)(
  "keeps an existing APE tag on an MP3",
  async () => {
    const filePath = await createFixture({
      fileName: "keeps-ape.mp3",
      format: "mp3",
    })

    const seededFile = File.createFromPath(filePath)
    seededFile.getTag(TagTypes.Ape, true).title =
      "Ape Title"
    seededFile.save()
    seededFile.dispose()

    await writeAudioTags({
      filePath,
      tags: { title: "Id3 Title" },
    })

    const readBackFile = File.createFromPath(filePath)
    const hasApeTag =
      (readBackFile.tagTypesOnDisk & TagTypes.Ape) !== 0
    const apeTitle = readBackFile.getTag(
      TagTypes.Ape,
      false,
    )?.title
    readBackFile.dispose()

    expect(hasApeTag).toBe(true)
    expect(apeTitle).toBe("Ape Title")
  },
)

test.skipIf(isFfmpegMissing)(
  "keeps an existing ID3v2 tag on a FLAC",
  async () => {
    const filePath = await createFixture({
      fileName: "keeps-id3.flac",
      format: "flac",
    })

    const seededFile = File.createFromPath(filePath)
    seededFile.getTag(TagTypes.Id3v2, true).title =
      "Id3 Title"
    seededFile.save()
    seededFile.dispose()

    await writeAudioTags({
      filePath,
      tags: { title: "Xiph Title" },
    })

    const readBackFile = File.createFromPath(filePath)
    const hasId3v2Tag =
      (readBackFile.tagTypesOnDisk & TagTypes.Id3v2) !== 0
    const id3Title = readBackFile.getTag(
      TagTypes.Id3v2,
      false,
    )?.title
    const xiphTitle = readBackFile.getTag(
      TagTypes.Xiph,
      false,
    )?.title
    readBackFile.dispose()

    expect(hasId3v2Tag).toBe(true)
    expect(id3Title).toBe("Id3 Title")
    expect(xiphTitle).toBe("Xiph Title")
  },
)

test("rejects with an error naming the file when the file is missing", async () => {
  const filePath = getFixtureFilePath("missing.flac")

  await expect(
    writeAudioTags({ filePath, tags: { title: "Nope" } }),
  ).rejects.toThrow(
    `Cannot write audio tags to "${filePath}"`,
  )
})
