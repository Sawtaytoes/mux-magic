import chardet from "chardet"
import iconv from "iconv-lite"

// Pure decode: try strict UTF-8 first (catches ~95% of modern content);
// on failure, fall back to chardet's top guess decoded via iconv-lite.
//
// The decode is deliberately byte-first and ignores any externally declared
// charset (HTTP Content-Type, etc.). The failure mode this guards against is
// a source that *mislabels* Windows-1252 bytes as UTF-8 — e.g. DVDCompare's
// migrated legacy listings, whose smart quotes (0x91-0x94) are invalid UTF-8.
// A strict UTF-8 decoder throws on those bytes (instead of silently emitting
// U+FFFD), which is what lets the fallback recover the real characters.
//
// The strict UTF-8 attempt is also what catches Shift_JIS / Windows-1252
// reliably — both contain byte sequences a permissive decoder would replace
// with U+FFFD rather than throw.
export const decodeBufferWithEncodingFallback = (
  buffer: Buffer,
  onFallback?: (charset: string) => void,
): string => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(
      buffer,
    )
  } catch {
    const guess = chardet.detect(buffer) ?? "windows-1252"
    // HTML5 decodes the ISO-8859-1 label as Windows-1252; the 0x80-0x9F
    // range (smart quotes, en/em dashes) is undefined in true ISO-8859-1 but
    // defined in 1252, so normalizing here makes that recovery deterministic.
    const charset = /iso-8859-1|latin1/i.test(guess)
      ? "windows-1252"
      : guess
    onFallback?.(charset)
    return iconv.decode(buffer, charset)
  }
}

// HTTP wrapper. `Response.text()` decodes strictly by the Content-Type
// charset and silently yields U+FFFD on a charset mismatch. Reading the raw
// bytes and running them through decodeBufferWithEncodingFallback recovers
// mislabeled Windows-1252 pages instead of corrupting them.
export const decodeResponseText = async (response: {
  arrayBuffer: () => Promise<ArrayBuffer>
}): Promise<string> =>
  decodeBufferWithEncodingFallback(
    Buffer.from(await response.arrayBuffer()),
  )
