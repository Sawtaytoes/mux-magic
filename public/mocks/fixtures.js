// Canned data shared by the browser MSW worker and the Node `setupServer`
// vitest harness. Pure data — no imports, no MSW symbols. Both the
// browser handlers (public/api/mocks/handlers.js) and the Node handlers
// (src/__shared__/msw-handlers.ts) consume this so the canned scenario
// stays in lockstep across the two runtimes.
//
// Scenario covers the three terminal states the Jobs UI cares about:
//   - jobInProgress  : a sequence umbrella (running) with one running
//                      child step + one pending step that hasn't started
//                      yet. Exercises live progress + the "Steps (n)"
//                      disclosure.
//   - jobSucceeded   : a single-command job that completed cleanly.
//                      Exercises the green "completed" badge + Results.
//   - jobFailed      : a single-command job that failed. Exercises the
//                      red "failed" badge + the error block.

const inProgressUmbrellaId = "00000000-0000-4000-8000-000000000001"
const inProgressRunningStepId = "00000000-0000-4000-8000-000000000002"
const inProgressPendingStepId = "00000000-0000-4000-8000-000000000003"
const succeededJobId = "00000000-0000-4000-8000-000000000010"
const failedJobId = "00000000-0000-4000-8000-000000000020"

export const mockJobIds = {
  inProgressUmbrellaId,
  inProgressRunningStepId,
  inProgressPendingStepId,
  succeededJobId,
  failedJobId,
}

const nowIso = () => new Date().toISOString()

// Authoritative job snapshots (without `logs` — the /jobs/stream route
// strips `logs` before broadcasting). The Jobs UI's upsertJob expects
// these fields verbatim.
export const mockJobs = [
  {
    id: inProgressUmbrellaId,
    commandName: "sequence",
    status: "running",
    params: {
      paths: { source: { value: "C:\\fake\\videos" } },
      steps: [
        { id: "step1", command: "extractSubtitles", params: { sourcePath: "@source" } },
        { id: "step2", command: "renameDemos", params: { sourcePath: "@source" } },
      ],
    },
    results: [],
    outputs: null,
    error: null,
    startedAt: nowIso(),
    completedAt: null,
    parentJobId: null,
    stepId: null,
  },
  {
    id: inProgressRunningStepId,
    commandName: "extractSubtitles",
    status: "running",
    params: { sourcePath: "C:\\fake\\videos" },
    results: [],
    outputs: null,
    error: null,
    startedAt: nowIso(),
    completedAt: null,
    parentJobId: inProgressUmbrellaId,
    stepId: "step1",
  },
  {
    id: inProgressPendingStepId,
    commandName: "renameDemos",
    status: "pending",
    params: { sourcePath: "C:\\fake\\videos" },
    results: [],
    outputs: null,
    error: null,
    startedAt: null,
    completedAt: null,
    parentJobId: inProgressUmbrellaId,
    stepId: "step2",
  },
  {
    id: succeededJobId,
    commandName: "renameDemos",
    status: "completed",
    params: { sourcePath: "C:\\fake\\old-demos" },
    results: [{ renamed: 5 }],
    outputs: null,
    error: null,
    startedAt: new Date(Date.now() - 90_000).toISOString(),
    completedAt: new Date(Date.now() - 60_000).toISOString(),
    parentJobId: null,
    stepId: null,
  },
  {
    id: failedJobId,
    commandName: "extractSubtitles",
    status: "failed",
    params: { sourcePath: "C:\\fake\\broken-folder" },
    results: [],
    outputs: null,
    error: "ENOENT: no such file or directory, scandir 'C:\\fake\\broken-folder'",
    startedAt: new Date(Date.now() - 45_000).toISOString(),
    completedAt: new Date(Date.now() - 40_000).toISOString(),
    parentJobId: null,
    stepId: null,
  },
]

// Buffered log lines per job for /jobs/:id/logs replay. The running
// child gets a few lines that imply mid-stream activity; the umbrella
// gets sequence-level markers; terminals carry their final summary.
export const mockJobLogs = {
  [inProgressUmbrellaId]: [
    "[SEQUENCE] starting 2-step pipeline",
    "[SEQUENCE] step 1/2: extractSubtitles",
  ],
  [inProgressRunningStepId]: [
    "Scanning C:\\fake\\videos…",
    "Found 3 files with embedded subtitles",
    "Extracting 1/3: episode-01.mkv",
  ],
  [inProgressPendingStepId]: [],
  [succeededJobId]: [
    "Scanning C:\\fake\\old-demos…",
    "Renamed 5 files",
    "Done.",
  ],
  [failedJobId]: [
    "Scanning C:\\fake\\broken-folder…",
    "ERROR: ENOENT: no such file or directory, scandir 'C:\\fake\\broken-folder'",
  ],
}

// Shape mirrors the real /files/list response (see schemas.ts:
// listFilesResponseSchema).
export const mockFilesList = {
  entries: [
    { name: "Movies", isFile: false, isDirectory: true, size: 0, mtime: nowIso(), duration: null },
    { name: "TV Shows", isFile: false, isDirectory: true, size: 0, mtime: nowIso(), duration: null },
    { name: "demo.mkv", isFile: true, isDirectory: false, size: 1_500_000_000, mtime: nowIso(), duration: "1:45:12" },
    { name: "trailer.mp4", isFile: true, isDirectory: false, size: 80_000_000, mtime: nowIso(), duration: "2:30" },
  ],
  separator: "\\",
  error: null,
}

// Builder typeahead (see schemas.listDirectoryEntriesResponseSchema).
export const mockDirectoryEntries = {
  entries: [
    { name: "Movies", isDirectory: true },
    { name: "TV Shows", isDirectory: true },
    { name: "demo.mkv", isDirectory: false },
  ],
  separator: "\\",
  error: null,
}

// Stub responses for the Builder's lookup queries. Only the shape that
// the UI cares about is filled in — most fields are present but minimal.
export const mockSearchMalResults = {
  results: [
    { malId: 1, name: "Cowboy Bebop", airDate: "1998", mediaType: "TV", imageUrl: "" },
    { malId: 2, name: "Trigun", airDate: "1998", mediaType: "TV", imageUrl: "" },
  ],
  error: null,
}
