// LEGACY-ONLY (worker 43+). Kept for backward decoding of `?seq=` URLs that
// were produced before the switch to ?seqJson= (base64url + minified JSON).
// The BuilderPage reader still calls this as a fall-back when ?seqJson= is
// absent, so old shared URLs keep loading. New code MUST use the
// ?seqJson= decoder (decodeSeqJsonParam.ts).
//
// Decodes the `?seq=` query parameter that the builder uses for shareable URLs.
//
// The encoder (buildBuilderUrl.ts) wraps the payload in:
//   btoa(unescape(encodeURIComponent(text)))
// to round-trip Unicode safely through atob (which only accepts Latin-1).
// We reverse that here. The decoded text is either YAML or JSON depending on
// who produced the URL:
//   - Legacy vanilla builder produced YAML directly.
//   - The current React `buildBuilderUrl` (JobCard "re-edit") produces JSON.
// Both are valid YAML, so loadYamlFromText accepts either and the caller
// doesn't need to branch.

export const decodeSeqParam = (
  encoded: string | null | undefined,
): string | null => {
  if (!encoded) return null
  try {
    return decodeURIComponent(escape(atob(encoded)))
  } catch {
    // Malformed base64 or post-decode bytes that aren't valid URI-encoded
    // UTF-8. Returning null is the right "ignore the broken URL" behavior;
    // the caller is responsible for surfacing or swallowing the failure.
    return null
  }
}
