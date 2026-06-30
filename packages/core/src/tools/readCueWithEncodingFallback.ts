import { readFile } from "node:fs/promises"
import { logInfo } from "@mux-magic/tools"
import { decodeBufferWithEncodingFallback } from "./decodeBufferWithEncodingFallback.js"

// Pure decode: try strict UTF-8 first (catches ~95% of modern CUEs);
// fall back to chardet's top guess decoded via iconv-lite. Shared with the
// HTTP-response decoder via decodeBufferWithEncodingFallback.
//
// No confidence thresholding — chardet's top guess is used
// unconditionally. If a misdetection is reported, add thresholding
// then (per worker 75 Out-of-scope notes).
export const decodeCueBuffer = (buffer: Buffer): string =>
  decodeBufferWithEncodingFallback(buffer)

// File-reading wrapper used by the split pipeline.
export const readCueWithEncodingFallback = async (
  cuePath: string,
): Promise<string> => {
  const buffer = await readFile(cuePath)
  return decodeBufferWithEncodingFallback(
    buffer,
    (charset) =>
      logInfo("CUE", `${cuePath}: decoded as ${charset}`),
  )
}
