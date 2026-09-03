import { vol } from "memfs"
import { firstValueFrom } from "rxjs"
import { beforeEach, expect, test, vi } from "vitest"

import { readAudioDateFields } from "../music/tags/readAudioTags.js"
import { writeAudioTags } from "../music/tags/writeAudioTags.js"
import { copyAudioReleaseDateIntoDate } from "./copyAudioReleaseDateIntoDate.js"

vi.mock("../music/tags/readAudioTags.js", () => ({
  readAudioDateFields: vi.fn(),
}))
vi.mock("../music/tags/writeAudioTags.js", () => ({
  writeAudioTags: vi.fn(),
}))

beforeEach(() => {
  vol.reset()
  vi.mocked(readAudioDateFields).mockReset()
  vi.mocked(writeAudioTags).mockReset()
  vi.mocked(writeAudioTags).mockResolvedValue(undefined)
})

test("copies Release Date into Date only when Date is missing", async () => {
  vol.fromJSON({
    "/music/needs-date.flac": "x",
    "/music/has-date.flac": "x",
    "/music/no-release-date.flac": "x",
  })
  vi.mocked(readAudioDateFields).mockImplementation(
    (filePath: string) =>
      Promise.resolve(
        filePath.endsWith("needs-date.flac")
          ? { releaseDate: "2024-07-17" }
          : filePath.endsWith("has-date.flac")
            ? {
                date: "2024",
                releaseDate: "2024-07-17",
              }
            : {},
      ),
  )

  const records = await firstValueFrom(
    copyAudioReleaseDateIntoDate({
      isDryRun: false,
      sourcePath: "/music",
    }),
  )

  expect(records).toEqual(
    expect.arrayContaining([
      {
        date: "2024-07-17",
        filePath: "/music/needs-date.flac",
        filename: "needs-date.flac",
        isDryRun: false,
        kind: "copied",
        releaseDate: "2024-07-17",
      },
      {
        date: "2024",
        filePath: "/music/has-date.flac",
        filename: "has-date.flac",
        kind: "skipped",
        reason: "Date is already set.",
        releaseDate: "2024-07-17",
      },
    ]),
  )
  expect(writeAudioTags).toHaveBeenCalledOnce()
  expect(writeAudioTags).toHaveBeenCalledWith({
    filePath: "/music/needs-date.flac",
    isTimestampPreserved: true,
    tags: { date: "2024-07-17" },
  })
})

test("defaults to a dry run and does not write", async () => {
  vol.fromJSON({ "/music/track.mp3": "x" })
  vi.mocked(readAudioDateFields).mockResolvedValue({
    releaseDate: "2010-08-27",
  })

  const records = await firstValueFrom(
    copyAudioReleaseDateIntoDate({ sourcePath: "/music" }),
  )

  expect(records[0]).toMatchObject({
    date: "2010-08-27",
    isDryRun: true,
    kind: "copied",
    releaseDate: "2010-08-27",
  })
  expect(writeAudioTags).not.toHaveBeenCalled()
})

test("one unreadable file fails alone", async () => {
  vol.fromJSON({
    "/music/broken.flac": "x",
    "/music/good.flac": "x",
  })
  vi.mocked(readAudioDateFields).mockImplementation(
    (filePath: string) =>
      filePath.endsWith("broken.flac")
        ? Promise.reject(new Error("bad tags"))
        : Promise.resolve({ releaseDate: "1992" }),
  )

  const records = await firstValueFrom(
    copyAudioReleaseDateIntoDate({ sourcePath: "/music" }),
  )

  expect(records).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        filename: "broken.flac",
        kind: "failed",
        reason: "bad tags",
      }),
      expect.objectContaining({
        filename: "good.flac",
        kind: "copied",
      }),
    ]),
  )
})
