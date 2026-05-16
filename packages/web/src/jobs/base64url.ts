// base64url codec — RFC 4648 §5 (URL- and filename-safe alphabet, no padding).
//
// Differs from standard base64 in two ways:
//   - '+' → '-', '/' → '_'  (URL-safe)
//   - trailing '=' padding is dropped
//
// We delegate the actual encode/decode work to btoa/atob (which speak standard
// base64) and translate at the boundaries. The bytes → binary-string step uses
// reduce + String.fromCharCode (NOT TextDecoder("latin1") — that aliases to
// windows-1252 in WHATWG Encoding, which remaps 0x80-0x9F to Unicode code
// points > 0xFF that btoa then rejects). Decode goes the other way via
// Uint8Array.from + charCodeAt, no loop or per-index mutation needed.

const BASE64URL_ALPHABET = /^[A-Za-z0-9_-]*$/

export const toBase64Url = (bytes: Uint8Array): string => {
  const binary = bytes.reduce(
    (accumulator, byte) =>
      accumulator + String.fromCharCode(byte),
    "",
  )
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

export const fromBase64Url = (
  encoded: string,
): Uint8Array | null => {
  if (!BASE64URL_ALPHABET.test(encoded)) return null

  // base64 decodes 4 characters → 3 bytes. A length of length%4 === 1 is
  // never produced by a valid encoder; reject before atob has a chance to
  // be lenient about it.
  const remainder = encoded.length % 4
  if (remainder === 1) return null

  const padded =
    remainder === 0
      ? encoded
      : encoded + "=".repeat(4 - remainder)
  const standard = padded
    .replace(/-/g, "+")
    .replace(/_/g, "/")

  try {
    const binary = atob(standard)
    return Uint8Array.from(binary, (character) =>
      character.charCodeAt(0),
    )
  } catch {
    return null
  }
}
