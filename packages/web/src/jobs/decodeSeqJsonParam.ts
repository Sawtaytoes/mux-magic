// Decoder for the Builder's `?seqJson=` URL parameter.
//
// Reverses encodeSeqJsonParam: validates base64url alphabet, decodes to
// bytes, then UTF-8-decodes (fatal mode — invalid sequences return null
// rather than substituting U+FFFD). Returns null for any malformed input
// so the caller can cleanly fall back to `?seq=` legacy parsing.

import { fromBase64Url } from "./base64url"

const utf8DecoderStrict = new TextDecoder("utf-8", {
  fatal: true,
})

export const decodeSeqJsonParam = (
  encoded: string | null | undefined,
): string | null => {
  if (!encoded) return null
  const bytes = fromBase64Url(encoded)
  if (!bytes) return null
  try {
    return utf8DecoderStrict.decode(bytes)
  } catch {
    return null
  }
}
