import { mkdtemp, rm, stat, utimes } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { File } from "node-taglib-sharp"
import { afterAll, expect, test, vi } from "vitest"

import {
  type AudioFixtureFormat,
  generateAudioFixture,
  getIsFfmpegAvailable,
} from "../fixtures/generateAudioFixture.js"
import { readAudioTags } from "../tags/readAudioTags.js"
import type { CoverArtImage } from "./coverArtImage.js"
import { writeEmbeddedCoverArt } from "./writeEmbeddedCoverArt.js"

vi.unmock("node:fs")
vi.unmock("node:fs/promises")
vi.unmock("../../cli-spawn-operations/runFfmpeg.js")
vi.unmock("../../cli-spawn-operations/treeKillChild.js")

const isFfmpegAvailable = await getIsFfmpegAvailable()
const isFfmpegMissing = !isFfmpegAvailable

if (isFfmpegMissing) {
  console.warn(
    "writeEmbeddedCoverArt.test.ts: ffmpeg is not on PATH, so every fixture-backed test is skipped.",
  )
}

const fixtureDirectoryPath = await mkdtemp(
  join(tmpdir(), "write-embedded-cover-art-"),
)

afterAll(async () => {
  await rm(fixtureDirectoryPath, {
    force: true,
    recursive: true,
  })
})

// A one-pixel PNG. The bytes only have to be a real image that taglib will
// store and hand back; nothing here decodes it.
const ONE_PIXEL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

const buildImage = (): CoverArtImage => ({
  bytes: Uint8Array.from(
    Buffer.from(ONE_PIXEL_PNG_BASE64, "base64"),
  ),
  mimeType: "image/png",
})

const buildSecondImage = (): CoverArtImage => ({
  bytes: Uint8Array.from(
    Buffer.from(ONE_PIXEL_PNG_BASE64, "base64").subarray(
      0,
      60,
    ),
  ),
  mimeType: "image/png",
})

const createFixture = ({
  fileName,
  format,
}: {
  fileName: string
  format: AudioFixtureFormat
}) =>
  generateAudioFixture({
    format,
    outputPath: join(fixtureDirectoryPath, fileName),
  })

// The description is deliberately not asserted. An MP4 `covr` atom has no
// field for one, so taglib reports the filename it inferred instead of the
// "Cover (front)" written into every other container.
const readPictures = (filePath: string) => {
  const audioFile = File.createFromPath(filePath)

  try {
    return audioFile.tag.pictures.map((picture) => ({
      byteCount: picture.data.length,
      mimeType: picture.mimeType,
    }))
  } finally {
    audioFile.dispose()
  }
}

const embedFormats: AudioFixtureFormat[] = [
  "flac",
  "mp3",
  "m4a",
  "opus",
]

embedFormats.forEach((format) => {
  test.skipIf(isFfmpegMissing)(
    `embeds one front cover in a ${format} file`,
    async () => {
      const filePath = await createFixture({
        fileName: `embed.${format}`,
        format,
      })
      const image = buildImage()

      expect(
        await writeEmbeddedCoverArt({ filePath, image }),
      ).toEqual({ isChanged: true })

      expect(readPictures(filePath)).toEqual([
        {
          byteCount: image.bytes.length,
          mimeType: "image/png",
        },
      ])

      const { info } = await readAudioTags(filePath)

      expect(info.hasEmbeddedCoverArt).toBe(true)
    },
  )
})

test.skipIf(isFfmpegMissing)(
  "writing the same image twice is a no-op the second time",
  async () => {
    const filePath = await createFixture({
      fileName: "idempotent.flac",
      format: "flac",
    })
    const image = buildImage()

    await writeEmbeddedCoverArt({ filePath, image })

    const fileStatsAfterFirstWrite = await stat(filePath)

    expect(
      await writeEmbeddedCoverArt({ filePath, image }),
    ).toEqual({ isChanged: false })

    expect((await stat(filePath)).mtimeMs).toBe(
      fileStatsAfterFirstWrite.mtimeMs,
    )
  },
)

test.skipIf(isFfmpegMissing)(
  "a different image replaces the one already embedded, leaving exactly one",
  async () => {
    const filePath = await createFixture({
      fileName: "replace.flac",
      format: "flac",
    })

    await writeEmbeddedCoverArt({
      filePath,
      image: buildImage(),
    })

    const secondImage = buildSecondImage()

    expect(
      await writeEmbeddedCoverArt({
        filePath,
        image: secondImage,
      }),
    ).toEqual({ isChanged: true })

    expect(readPictures(filePath)).toEqual([
      {
        byteCount: secondImage.bytes.length,
        mimeType: "image/png",
      },
    ])
  },
)

test.skipIf(isFfmpegMissing)(
  "a dry run reports the change and writes nothing",
  async () => {
    const filePath = await createFixture({
      fileName: "dry-run.flac",
      format: "flac",
    })

    expect(
      await writeEmbeddedCoverArt({
        filePath,
        image: buildImage(),
        isDryRun: true,
      }),
    ).toEqual({ isChanged: true })

    expect(readPictures(filePath)).toEqual([])
  },
)

test.skipIf(isFfmpegMissing)(
  "restores the modified time so a re-tag does not look like a new album",
  async () => {
    const filePath = await createFixture({
      fileName: "timestamps.flac",
      format: "flac",
    })
    const originalTime = new Date(
      "2019-05-17T10:11:12.000Z",
    )

    await utimes(filePath, originalTime, originalTime)

    await writeEmbeddedCoverArt({
      filePath,
      image: buildImage(),
    })

    expect((await stat(filePath)).mtime.toISOString()).toBe(
      originalTime.toISOString(),
    )
  },
)

test.skipIf(isFfmpegMissing)(
  "leaves the modified time alone when asked not to preserve it",
  async () => {
    const filePath = await createFixture({
      fileName: "timestamps-off.flac",
      format: "flac",
    })
    const originalTime = new Date(
      "2019-05-17T10:11:12.000Z",
    )

    await utimes(filePath, originalTime, originalTime)

    await writeEmbeddedCoverArt({
      filePath,
      image: buildImage(),
      isTimestampPreserved: false,
    })

    expect((await stat(filePath)).mtimeMs).toBeGreaterThan(
      originalTime.getTime(),
    )
  },
)

test("names the file in the error when it cannot be read", async () => {
  await expect(
    writeEmbeddedCoverArt({
      filePath: join(fixtureDirectoryPath, "missing.flac"),
      image: buildImage(),
    }),
  ).rejects.toThrow(/Cannot write cover art to/u)
})
