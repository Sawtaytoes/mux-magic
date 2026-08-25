import type { FingerprintMatchedRecord } from "./fingerprintResultTypes"

// Shared fixture builders for the fingerprint stories and tests.
//
// ⚠️ Invented album and artist names on purpose. A story is a PNG in a
// pull request and a fixture is opaque to every grep, so nothing here
// names anything from the real library.

export const buildFingerprintMatch = ({
  filename = "01 Slack Water.flac",
  hasRecording = true,
  score = 0.97,
}: {
  filename?: string
  hasRecording?: boolean
  score?: number
} = {}): FingerprintMatchedRecord => ({
  acoustId: `acoust-${filename}`,
  duration: 210.4,
  filePath: `/inbox/Nova Harbour/Tidewater/${filename}`,
  filename,
  fingerprint: `AQAD-${filename}`,
  kind: "matched",
  recordings: hasRecording
    ? [
        {
          artistNames: ["Nova Harbour"],
          durationSeconds: 210,
          musicBrainzArtistIds: ["artist-1"],
          recordingId: `recording-${filename}`,
          releaseGroupIds: ["release-group-1"],
          title: filename.replace(/^\d+\s|\.flac$/gu, ""),
        },
      ]
    : [],
  score,
})
