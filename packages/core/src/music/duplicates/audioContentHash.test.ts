import { vol } from "memfs"
import { beforeEach, describe, expect, test } from "vitest"

import { readFlacStreamInfoMd5 } from "./audioContentHash.js"

// A hand-built FLAC header. The point of the test is the offsets, and a
// real FLAC would only obscure them — the format fixes "fLaC", then a
// 4-byte metadata block header, then a 34-byte STREAMINFO whose last 16
// bytes are the MD5 of the unencoded audio.
const buildFlacHeader = (md5Hex: string) =>
  Buffer.concat([
    Buffer.from("fLaC", "ascii"),
    Buffer.from([0x00, 0x00, 0x00, 0x22]),
    Buffer.alloc(18),
    Buffer.from(md5Hex, "hex"),
  ])

const writeFixture = ({
  contents,
  filePath,
}: {
  contents: Buffer
  filePath: string
}) => {
  vol.mkdirSync("/library", { recursive: true })
  vol.writeFileSync(filePath, contents)
  return filePath
}

describe(readFlacStreamInfoMd5.name, () => {
  beforeEach(() => {
    vol.reset()
  })

  // The whole reason this exists: a FLAC-to-FLAC comparison needs 42
  // bytes off the front of the file instead of a full decode.
  test("reads the stored MD5 without decoding the file", async () => {
    expect(
      await readFlacStreamInfoMd5(
        writeFixture({
          contents: buildFlacHeader(
            "0123456789abcdef0123456789abcdef",
          ),
          filePath: "/library/stored.flac",
        }),
      ),
    ).toBe("0123456789abcdef0123456789abcdef")
  })

  // An all-zero MD5 means the encoder declined to store one. It is
  // "unknown", not "empty audio" — returning it would make every
  // MD5-less FLAC compare equal to every other one.
  test("treats an all-zero MD5 as absent, not as a value", async () => {
    expect(
      await readFlacStreamInfoMd5(
        writeFixture({
          contents: buildFlacHeader("0".repeat(32)),
          filePath: "/library/unset.flac",
        }),
      ),
    ).toBeNull()
  })

  test("returns null for a file that is not a FLAC", async () => {
    expect(
      await readFlacStreamInfoMd5(
        writeFixture({
          contents: Buffer.alloc(64, 0x41),
          filePath: "/library/notaflac.flac",
        }),
      ),
    ).toBeNull()
  })
})
