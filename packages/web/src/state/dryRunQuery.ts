// ─── Dry-Run query-string helper ──────────────────────────────────────────────
//
// The server detects "fake / dry-run" mode via a `?fake=...` query param
// on the request URL (see packages/server/src/fake-data/index.ts:
// `isFakeRequest`, `getFakeScenario`). The client's `dryRunAtom` /
// `failureModeAtom` state previously updated localStorage + the DRY RUN
// badge ONLY — no fetch ever forwarded the flag — which meant every
// "dry run" was a real run on the server. This caused real file
// deletions via the `deleteFolder` command while the UI showed dry-run
// state.
//
// `buildRunFetchUrl` is the single chokepoint every command-run fetch
// (sequences, single steps, groups) MUST pass through, so dry-run state
// is forwarded uniformly to the server.

export type DryRunInputs = {
  isDryRun: boolean
  isFailureMode: boolean
}

export const buildRunFetchUrl = (
  baseUrl: string,
  inputs: DryRunInputs,
): string => {
  if (!inputs.isDryRun) return baseUrl
  const fakeValue = inputs.isFailureMode ? "failure" : "1"
  const separator = baseUrl.includes("?") ? "&" : "?"
  return `${baseUrl}${separator}fake=${fakeValue}`
}
