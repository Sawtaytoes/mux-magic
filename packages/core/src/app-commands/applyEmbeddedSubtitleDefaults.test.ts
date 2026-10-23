import { readFileSync } from "node:fs"
import * as fileSystem from "node:fs/promises"
import { basename } from "node:path"
import { vol } from "memfs"
import { firstValueFrom } from "rxjs"
import { expect, test, vi } from "vitest"
import { applyEmbeddedSubtitleDefaults } from "./applyEmbeddedSubtitleDefaults.js"

const element = ({
  identifier,
  bytes,
}: {
  identifier: string
  bytes: Buffer
}) =>
  Buffer.concat([
    Buffer.from(identifier, "hex"),
    bytes.length < 127
      ? Buffer.from([0x80 + bytes.length])
      : Buffer.from([
          0x40 + (bytes.length >> 8),
          bytes.length & 0xff,
        ]),
    bytes,
  ])
const header = `[Script Info]\r\nScriptType: v4.00+\r\nPlayResX: 1920\r\nPlayResY: 1080\r\nYCbCr Matrix: TV.601\r\n\r\n[V4+ Styles]\r\nFormat: Name, Fontname, Fontsize, MarginL, MarginR, MarginV\r\nStyle: Default,Example Sans,60,10,10,20\r\n\r\n[Events]\r\nFormat: Layer, Start, End, Style, Name, Text\r\n${" ".repeat(100)}`
const packetBytes = Buffer.from(
  "video-audio-subtitle-packets-and-timestamps-must-stay-byte-identical",
)
const fixture = () =>
  Buffer.concat([
    element({
      identifier: "1a45dfa3",
      bytes: Buffer.alloc(0),
    }),
    element({
      identifier: "18538067",
      bytes: Buffer.concat([
        element({
          identifier: "1654ae6b",
          bytes: element({
            identifier: "ae",
            bytes: Buffer.concat([
              element({
                identifier: "83",
                bytes: Buffer.from([17]),
              }),
              element({
                identifier: "86",
                bytes: Buffer.from("S_TEXT/ASS"),
              }),
              element({
                identifier: "63a2",
                bytes: Buffer.from(header),
              }),
            ]),
          }),
        }),
        element({
          identifier: "1f43b675",
          bytes: packetBytes,
        }),
      ]),
    }),
  ])

test("creates a separate output with unchanged media bytes and source", async () => {
  const original = fixture()
  vol.fromJSON({ "/staged/episode.mkv": original })
  const result = await firstValueFrom(
    applyEmbeddedSubtitleDefaults({
      sourcePath: "/staged",
    }),
  )
  const output = readFileSync(
    "/staged/SUBTITLE-DEFAULTS/episode.mkv",
  )
  expect(
    readFileSync("/staged/episode.mkv").equals(original),
  ).toBe(true)
  expect(output.length).toBe(original.length)
  expect(
    output
      .subarray(-packetBytes.length)
      .equals(packetBytes),
  ).toBe(true)
  expect(
    output.includes(
      Buffer.from("Example Sans,60,200,200,90"),
    ),
  ).toBe(true)
  expect(result).toMatchObject([
    {
      filePath: "/staged/SUBTITLE-DEFAULTS/episode.mkv",
      hasRewrittenMediaPackets: false,
    },
  ])
})

test("refuses to overwrite an earlier result", async () => {
  vol.fromJSON({
    "/staged/episode.mkv": fixture(),
    "/staged/SUBTITLE-DEFAULTS/episode.mkv":
      "preserved result",
  })
  await expect(
    firstValueFrom(
      applyEmbeddedSubtitleDefaults({
        sourcePath: "/staged",
      }),
    ),
  ).rejects.toThrow(/destination already exists/)
  expect(
    readFileSync(
      "/staged/SUBTITLE-DEFAULTS/episode.mkv",
      "utf8",
    ),
  ).toBe("preserved result")
})

test("does not recursively process its own output folder", async () => {
  vol.fromJSON({
    "/staged/SUBTITLE-DEFAULTS/episode.mkv":
      "not a Matroska file",
  })
  expect(
    await firstValueFrom(
      applyEmbeddedSubtitleDefaults({
        sourcePath: "/staged",
        isRecursive: true,
      }),
    ),
  ).toEqual([])
})

test("two concurrent runs cannot publish over each other's output", async () => {
  vol.fromJSON({ "/staged/episode.mkv": fixture() })
  const results = await Promise.allSettled(
    Array.from({ length: 2 }, () =>
      firstValueFrom(
        applyEmbeddedSubtitleDefaults({
          sourcePath: "/staged",
        }),
      ),
    ),
  )
  expect(
    results.filter(
      (result) => result.status === "fulfilled",
    ),
  ).toHaveLength(1)
  expect(
    results.filter(
      (result) => result.status === "rejected",
    ),
  ).toHaveLength(1)
  expect(
    readFileSync("/staged/SUBTITLE-DEFAULTS/episode.mkv")
      .subarray(-packetBytes.length)
      .equals(packetBytes),
  ).toBe(true)
  expect(
    vol.readdirSync("/staged/SUBTITLE-DEFAULTS"),
  ).toEqual(["episode.mkv"])
})

test("valid long media names do not produce work names beyond filesystem limits", async () => {
  const fileName = `${"e".repeat(240)}.mkv`
  vol.fromJSON({ [`/staged/${fileName}`]: fixture() })
  const renameSpy = vi.spyOn(fileSystem, "rename")
  const mkdirSpy = vi.spyOn(fileSystem, "mkdir")
  try {
    await firstValueFrom(
      applyEmbeddedSubtitleDefaults({
        sourcePath: "/staged",
      }),
    )
    expect(
      vol.existsSync(
        `/staged/SUBTITLE-DEFAULTS/${fileName}`,
      ),
    ).toBe(true)
    expect(renameSpy).toHaveBeenCalled()
    expect(mkdirSpy).toHaveBeenCalled()
    renameSpy.mock.calls.forEach(
      ([sourcePath, destinationPath]) => {
        expect(
          Buffer.byteLength(basename(String(sourcePath))),
        ).toBeLessThanOrEqual(255)
        expect(
          Buffer.byteLength(
            basename(String(destinationPath)),
          ),
        ).toBeLessThanOrEqual(255)
      },
    )
    mkdirSpy.mock.calls.forEach(([directory]) => {
      expect(
        Buffer.byteLength(basename(String(directory))),
      ).toBeLessThanOrEqual(255)
    })
  } finally {
    renameSpy.mockRestore()
    mkdirSpy.mockRestore()
  }
})
