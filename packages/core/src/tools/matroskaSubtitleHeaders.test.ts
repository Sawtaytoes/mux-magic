import { crc32 } from "node:zlib"
import { vol } from "memfs"
import { describe, expect, test } from "vitest"
import {
  inspectMatroskaTrackHeaders,
  readMatroskaTracks,
  rewriteMatroskaSubtitleHeaders,
} from "./matroskaSubtitleHeaders.js"

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
const checksum = (buffer: Buffer) =>
  ((value) =>
    element({
      identifier: "bf",
      bytes: Buffer.from([
        value & 0xff,
        (value >>> 8) & 0xff,
        (value >>> 16) & 0xff,
        value >>> 24,
      ]),
    }))(crc32(buffer))
const master = ({
  identifier,
  bytes,
  hasChecksum,
}: {
  identifier: string
  bytes: Buffer
  hasChecksum: boolean
}) =>
  element({
    identifier,
    bytes: hasChecksum
      ? Buffer.concat([checksum(bytes), bytes])
      : bytes,
  })
const track = ({
  codec = "S_TEXT/ASS",
  header = "old-header",
  hasChecksum = false,
}: {
  codec?: string
  header?: string
  hasChecksum?: boolean
} = {}) =>
  master({
    identifier: "ae",
    hasChecksum,
    bytes: Buffer.concat([
      element({
        identifier: "d7",
        bytes: Buffer.from([3]),
      }),
      element({
        identifier: "83",
        bytes: Buffer.from([0x11]),
      }),
      element({
        identifier: "86",
        bytes: Buffer.from(codec),
      }),
      element({
        identifier: "63a2",
        bytes: Buffer.from(header),
      }),
    ]),
  })
const tracks = ({
  bytes,
  hasChecksum = false,
}: {
  bytes: Buffer
  hasChecksum?: boolean
}) => master({ identifier: "1654ae6b", bytes, hasChecksum })

describe("metadata-only ASS edits", () => {
  test("preserves the complete element for an identity transform, including both CRCs", () => {
    const original = tracks({
      bytes: track({ hasChecksum: true }),
      hasChecksum: true,
    })
    expect(
      rewriteMatroskaSubtitleHeaders({
        buffer: original,
        transform: (header) => header,
      }).equals(original),
    ).toBe(true)
  })
  test("updates nested checksums and keeps byte capacity constant", () => {
    const original = tracks({
      bytes: track({ hasChecksum: true }),
      hasChecksum: true,
    })
    const modified = rewriteMatroskaSubtitleHeaders({
      buffer: original,
      transform: () => "new",
    })
    expect(modified.length).toBe(original.length)
    expect(
      modified.includes(Buffer.from("new       ")),
    ).toBe(true)
    expect(
      rewriteMatroskaSubtitleHeaders({
        buffer: modified,
        transform: (header) => header,
      }).equals(modified),
    ).toBe(true)
  })
  test("leaves PGS tracks unchanged even when the ASS header changes", () => {
    const imageTrack = track({
      codec: "S_HDMV/PGS",
      header: "image-metadata",
    })
    const original = tracks({
      bytes: Buffer.concat([track(), imageTrack]),
    })
    const modified = rewriteMatroskaSubtitleHeaders({
      buffer: original,
      transform: () => "new",
    })
    expect(
      modified
        .subarray(-imageTrack.length)
        .equals(imageTrack),
    ).toBe(true)
  })
  test("refuses a header that would move packet offsets", () => {
    const original = tracks({ bytes: track() })
    expect(() =>
      rewriteMatroskaSubtitleHeaders({
        buffer: original,
        transform: () =>
          "a header larger than the original capacity",
      }),
    ).toThrow(/existing capacity/)
    expect(
      original.includes(Buffer.from("old-header")),
    ).toBe(true)
  })
  test("rejects corrupt source CRCs instead of repairing unrelated corruption", () => {
    const original = tracks({
      bytes: track(),
      hasChecksum: true,
    })
    const corrupted = Buffer.from(original)
    corrupted[corrupted.length - 1] ^= 1
    expect(() =>
      rewriteMatroskaSubtitleHeaders({
        buffer: corrupted,
        transform: () => "new",
      }),
    ).toThrow(/CRC-32 does not match/)
  })
  test("rejects truncation and unknown-length children", () => {
    const original = tracks({ bytes: track() })
    expect(() =>
      rewriteMatroskaSubtitleHeaders({
        buffer: original.subarray(0, -1),
        transform: (header) => header,
      }),
    ).toThrow()
    expect(() =>
      rewriteMatroskaSubtitleHeaders({
        buffer: Buffer.from("1654ae6b81ff", "hex"),
        transform: (header) => header,
      }),
    ).toThrow()
  })
})

test("the header inventory preserves integer identifiers and does not confuse them with codec data", () => {
  const original = tracks({ bytes: track() })
  expect(
    inspectMatroskaTrackHeaders(original),
  ).toMatchObject([
    {
      number: "3",
      type: "17",
      codecId: "S_TEXT/ASS",
      assHeader: "old-header",
    },
  ])
})

test("header capacity is measured in UTF-8 bytes", () => {
  const original = tracks({
    bytes: track({
      header: "room for unicode and padding",
    }),
  })
  const modified = rewriteMatroskaSubtitleHeaders({
    buffer: original,
    transform: () => "字幕",
  })
  expect(modified.length).toBe(original.length)
  expect(
    inspectMatroskaTrackHeaders(
      modified,
    )[0].assHeader?.trim(),
  ).toBe("字幕")
})

const seekFixture = (isTargetValid: boolean) => {
  const media = Buffer.concat(
    Array.from({ length: 300 }, () =>
      element({
        identifier: "1f43b675",
        bytes: Buffer.from("media"),
      }),
    ),
  )
  const seekHead = (position: number) =>
    element({
      identifier: "114d9b74",
      bytes: element({
        identifier: "4dbb",
        bytes: Buffer.concat([
          element({
            identifier: "53ab",
            bytes: Buffer.from("1654ae6b", "hex"),
          }),
          element({
            identifier: "53ac",
            bytes: Buffer.from([
              position >> 8,
              position & 0xff,
            ]),
          }),
        ]),
      }),
    })
  const expected = tracks({ bytes: track() })
  const segment = Buffer.concat([
    seekHead(
      isTargetValid
        ? seekHead(0).length + media.length
        : 0xffff,
    ),
    media,
    expected,
  ])
  return {
    file: Buffer.concat([
      element({
        identifier: "1a45dfa3",
        bytes: Buffer.alloc(0),
      }),
      element({ identifier: "18538067", bytes: segment }),
    ]),
    expected,
  }
}

test("uses SeekHead to reach track metadata relocated after many media clusters", async () => {
  const { file, expected } = seekFixture(true)
  vol.fromJSON({ "/relocated.mkv": file })
  const result = await readMatroskaTracks("/relocated.mkv")
  expect(result.buffer.equals(expected)).toBe(true)
  expect(
    file
      .subarray(
        result.position,
        result.position + expected.length,
      )
      .equals(expected),
  ).toBe(true)
})

test("refuses an out-of-file Tracks seek target", async () => {
  vol.fromJSON({
    "/invalid-seek.mkv": seekFixture(false).file,
  })
  await expect(
    readMatroskaTracks("/invalid-seek.mkv"),
  ).rejects.toThrow(/invalid Tracks seek target/)
})
