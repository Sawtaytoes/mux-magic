import { mkdir, mkdtemp, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, expect, test, vi } from "vitest"
import { readAudioTags } from "../tags/readAudioTags.js"
import {
  type AudioFixtureFormat,
  generateAudioFixture,
  getIsFfmpegAvailable,
} from "./generateAudioFixture.js"

vi.unmock("node:fs")
vi.unmock("node:fs/promises")
vi.unmock("../../cli-spawn-operations/runFfmpeg.js")
vi.unmock("../../cli-spawn-operations/treeKillChild.js")

const isFfmpegAvailable = await getIsFfmpegAvailable()
const isFfmpegMissing = !isFfmpegAvailable

if (isFfmpegMissing) {
  console.warn(
    "generateAudioFixture.test.ts: ffmpeg is not on PATH, so every fixture-backed test is skipped.",
  )
}

const fixtureDirectoryPath = await mkdtemp(
  join(tmpdir(), "generate-audio-fixture-"),
)

afterAll(async () => {
  await rm(fixtureDirectoryPath, {
    force: true,
    recursive: true,
  })
})

const getFixtureFilePath = (fileName: string) =>
  join(fixtureDirectoryPath, fileName)

const expectedCodecByFormat: Record<
  string,
  { codec: string; format: AudioFixtureFormat }
> = {
  flac: { codec: "FLAC", format: "flac" },
  m4a: { codec: "MPEG-4/AAC", format: "m4a" },
  mp3: { codec: "MPEG 1 Layer 3", format: "mp3" },
  opus: { codec: "Opus", format: "opus" },
}

Object.entries(expectedCodecByFormat).forEach(
  ([fileExtension, { codec, format }]) => {
    test.skipIf(isFfmpegMissing)(
      `generates a playable ${format} fixture`,
      async () => {
        const outputPath = getFixtureFilePath(
          `tone.${fileExtension}`,
        )

        const generatedPath = await generateAudioFixture({
          durationSeconds: 1,
          format,
          outputPath,
        })

        const fileStats = await stat(generatedPath)
        const { info } = await readAudioTags(generatedPath)

        expect(generatedPath).toBe(outputPath)
        expect(fileStats.size).toBeGreaterThan(0)
        expect(info.codec).toBe(codec)
        expect(info.durationSeconds).toBeGreaterThan(0)
      },
    )
  },
)

test.skipIf(isFfmpegMissing)(
  "writes the requested container metadata into the fixture",
  async () => {
    const outputPath = getFixtureFilePath("tagged.flac")

    await generateAudioFixture({
      format: "flac",
      outputPath,
      tags: {
        ARTIST: "Fixture Artist",
        TITLE: "Fixture Title",
      },
    })

    const { tags } = await readAudioTags(outputPath)

    expect(tags.title).toBe("Fixture Title")
    expect(tags.artist).toBe("Fixture Artist")
  },
)

test.skipIf(isFfmpegMissing)(
  "creates the output directory when it does not exist",
  async () => {
    const outputPath = getFixtureFilePath(
      join("nested", "deeper", "tone.flac"),
    )

    await generateAudioFixture({
      format: "flac",
      outputPath,
    })

    const fileStats = await stat(outputPath)

    expect(fileStats.size).toBeGreaterThan(0)
  },
)

test.skipIf(isFfmpegMissing)(
  "rejects with an error naming the output path when ffmpeg cannot write it",
  async () => {
    const outputPath = getFixtureFilePath(
      "already-a-directory",
    )

    await mkdir(outputPath, { recursive: true })

    await expect(
      generateAudioFixture({ format: "flac", outputPath }),
    ).rejects.toThrow(
      `Cannot generate the flac audio fixture at "${outputPath}"`,
    )
  },
)

test("reports whether ffmpeg is available", async () => {
  expect(typeof (await getIsFfmpegAvailable())).toBe(
    "boolean",
  )
})
