import { readFile } from "node:fs/promises"
import { logInfo } from "@mux-magic/tools"
import chardet from "chardet"
import iconv from "iconv-lite"

// Pure decode: try strict UTF-8 first (catches ~95% of modern CUEs);
// fall back to chardet's top guess decoded via iconv-lite. The strict
// UTF-8 attempt is what catches Shift_JIS / Windows-1252 reliably —
// both contain byte sequences a permissive UTF-8 decoder would
// substitute with U+FFFD instead of throwing.
//
// No confidence thresholding — chardet's top guess is used
// unconditionally. If a misdetection is reported, add thresholding
// then (per worker 75 Out-of-scope notes).
export const decodeCueBuffer = (buffer: Buffer): string => {
  try {
    const decoder = new TextDecoder("utf-8", {
      fatal: true,
    })
    return decoder.decode(buffer)
  } catch {
    const guess =
      chardet.detect(buffer) ?? "windows-1252"
    return iconv.decode(buffer, guess)
  }
}

// File-reading wrapper used by the split pipeline.
export const readCueWithEncodingFallback = async (
  cuePath: string,
): Promise<string> => {
  const buffer = await readFile(cuePath)
  try {
    const decoder = new TextDecoder("utf-8", {
      fatal: true,
    })
    return decoder.decode(buffer)
  } catch {
    const guess =
      chardet.detect(buffer) ?? "windows-1252"
    logInfo("CUE", `${cuePath}: decoded as ${guess}`)
    return iconv.decode(buffer, guess)
  }
}
