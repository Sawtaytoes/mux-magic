// LEGACY-ONLY (worker 43+). Kept compiled so any test or external caller
// that still produces `?seq=` URLs keeps working, but no live code path in
// the app emits these any more — the live writer in BuilderPage and
// buildBuilderUrl both use encodeSeqJsonParam.ts now. New code MUST use
// the ?seqJson= encoder.
//
// Inverse of decodeSeqParam.ts. Produces the base64 payload used by the
// builder's `?seq=` shareable URL. The encoding chain — encodeURIComponent +
// unescape + btoa — is the standard Unicode→Latin-1 round-trip that lets
// btoa accept arbitrary Unicode text (btoa itself rejects code points > 0xFF).
//
// Callers should pass YAML text produced by toYamlStr; decodeSeqParam then
// feeds that text back through loadYamlFromText on the receiving end.

export const encodeSeqParam = (text: string): string =>
  btoa(unescape(encodeURIComponent(text)))
