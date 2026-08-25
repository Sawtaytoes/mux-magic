import { execFile as execFileCallback } from "node:child_process"
import { open } from "node:fs/promises"
import { extname } from "node:path"
import { promisify } from "node:util"

import { ffmpegPath } from "../../tools/appPaths.js"

const execFile = promisify(execFileCallback)

// The hash of a file's DECODED audio, which is the only thing that proves
// two files are the same recording byte for byte. Tags, filenames and
// container differences all change the file hash and none of them change
// this one.
//
// ⚠️ This is what stops the dedup pass from deleting a different master.
// A `Track (1).flac` sitting beside `Track.flac` is NOT necessarily a
// copy — it is routinely a different edition, and the library has real
// examples. Only an identical audio hash settles it.

// FLAC stores an MD5 of the unencoded audio in its STREAMINFO block, so a
// FLAC-to-FLAC comparison needs no decode at all: 42 bytes off the front
// of the file instead of three minutes of CPU. The layout is fixed by the
// format — "fLaC" magic, a 4-byte metadata block header, then a 34-byte
// STREAMINFO whose last 16 bytes are the MD5.
const FLAC_MAGIC = "fLaC"
const FLAC_STREAMINFO_OFFSET = 8
const FLAC_STREAMINFO_LENGTH = 34
const FLAC_MD5_OFFSET_IN_STREAMINFO = 18

// An all-zero MD5 means the encoder declined to store one. It is "unknown",
// not "empty audio", so it must never compare equal to another file's.
const FLAC_UNSET_MD5 = "0".repeat(32)

export const readFlacStreamInfoMd5 = async (
  filePath: string,
): Promise<string | null> => {
  const fileHandle = await open(filePath, "r")
  // Held here rather than read back off the `read()` result: `read` fills
  // this buffer in place, and not every fs implementation hands the same
  // object back.
  const headerBuffer = Buffer.alloc(
    FLAC_STREAMINFO_OFFSET + FLAC_STREAMINFO_LENGTH,
  )

  try {
    // Positional form, not the options-object form. Both are Node APIs,
    // but memfs (which the core test suite substitutes for `node:fs`)
    // implements only this one — the object form silently fills nothing
    // and reports `bytesRead: NaN`.
    await fileHandle.read(
      headerBuffer,
      0,
      FLAC_STREAMINFO_OFFSET + FLAC_STREAMINFO_LENGTH,
      0,
    )

    return headerBuffer
      .subarray(0, FLAC_MAGIC.length)
      .toString("ascii") === FLAC_MAGIC
      ? ((md5: string) =>
          md5 === FLAC_UNSET_MD5 ? null : md5)(
          headerBuffer
            .subarray(
              FLAC_STREAMINFO_OFFSET +
                FLAC_MD5_OFFSET_IN_STREAMINFO,
              FLAC_STREAMINFO_OFFSET +
                FLAC_STREAMINFO_LENGTH,
            )
            .toString("hex"),
        )
      : null
  } finally {
    await fileHandle.close()
  }
}

// `-map a` takes the audio stream only, so cover art and chapters cannot
// change the answer. `-f md5 -` writes `MD5=<hex>` to stdout without
// producing a file.
export const decodeAudioMd5 = (filePath: string) =>
  execFile(ffmpegPath, [
    "-v",
    "error",
    "-i",
    filePath,
    "-map",
    "a",
    "-f",
    "md5",
    "-",
  ]).then(({ stdout }) =>
    ((md5: string) => (md5.length > 0 ? md5 : null))(
      stdout.trim().replace("MD5=", ""),
    ),
  )

export const getAudioContentHash = async (
  filePath: string,
): Promise<string | null> =>
  (extname(filePath).toLowerCase() === ".flac"
    ? await readFlacStreamInfoMd5(filePath)
    : null) ?? decodeAudioMd5(filePath)
