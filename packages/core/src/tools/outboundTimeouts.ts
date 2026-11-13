// Upper bounds for outbound calls that otherwise wait forever. A stalled
// probe or webhook holds its job open with no end, so each one fails
// with a clear error once its bound passes.

// mediainfo and `mkvmerge --identify` read headers, which takes seconds
// even on a large file over a network share.
export const MEDIA_PROBE_TIMEOUT_MS = 5 * 60 * 1000

// `makemkvcon info` scans every playlist on a disc backup. A disc with
// hundreds of obfuscation playlists can take many minutes, so this bound
// is generous. It applies to the info scan only, never to a rip.
export const MAKEMKV_INFO_TIMEOUT_MS = 30 * 60 * 1000

// A webhook receiver that accepts the connection and never answers would
// otherwise hold the POST open for Node's default socket timeouts.
export const WEBHOOK_TIMEOUT_MS = 10 * 1000
