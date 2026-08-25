// Narrow type mirrors of the server-side fingerprint shapes. The web
// side keeps its own copy — same pattern `tagMatchTypes.ts` and
// `duplicateCompareTypes.ts` use — so server-side type churn does not
// ripple into web typecheck.
//
// Source of truth: `FingerprintAudioFilesRecord` in
// `packages/core/src/app-commands/fingerprintAudioFiles.ts`.

export type FingerprintRecording = {
  artistNames: string[]
  durationSeconds: number | null
  musicBrainzArtistIds: string[]
  recordingId: string
  releaseGroupIds: string[]
  title: string
}

export type FingerprintMatchedRecord = {
  acoustId: string
  duration: number
  filePath: string
  filename: string
  fingerprint: string
  kind: "matched"
  recordings: FingerprintRecording[]
  score: number
}

export const isFingerprintMatch = (
  entry: unknown,
): entry is FingerprintMatchedRecord =>
  typeof entry === "object" &&
  entry !== null &&
  (entry as Record<string, unknown>).kind === "matched" &&
  typeof (entry as Record<string, unknown>).fingerprint ===
    "string" &&
  typeof (entry as Record<string, unknown>).acoustId ===
    "string"

export const findFingerprintMatches = (
  results: readonly unknown[] | null | undefined,
): FingerprintMatchedRecord[] =>
  results ? results.filter(isFingerprintMatch) : []

export type AcoustIdSubmissionPlan = {
  durationSeconds: number
  fingerprint: string
  musicBrainzRecordingId: string
}

// ⚠️ Only a row that already carries a MusicBrainz recording id is
// submittable. A fingerprint sent with no `mbid` adds an entry linked to
// nothing, which helps nobody and still counts as a public database
// write under the owner's account.
//
// The FIRST recording is used, because `fingerprintAudioFiles` returns
// them in AcoustID's own order and the panel is a batch action rather
// than a per-row picker. Anything needing a different recording is a
// per-row decision, and that belongs in the tag table.
export const buildAcoustIdSubmissionPlans = (
  matches: FingerprintMatchedRecord[],
): AcoustIdSubmissionPlan[] =>
  matches
    .filter((match) => match.recordings.length > 0)
    .map((match) => ({
      durationSeconds: match.duration,
      fingerprint: match.fingerprint,
      musicBrainzRecordingId:
        match.recordings[0].recordingId,
    }))
