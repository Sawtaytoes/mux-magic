// Canned data shared by the browser MSW worker and the Node `setupServer`
// vitest harness. Pure data — no imports, no MSW symbols. Both the
// browser handlers (public/mocks/handlers.js) and the Node handlers
// (src/__shared__/msw-handlers.ts) consume this so the canned scenario
// stays in lockstep across the two runtimes.
//
// Scenario covers the three terminal states the Jobs UI cares about:
//   - jobInProgress  : a sequence umbrella (running) with one running
//                      child step + one pending step that hasn't started.
//   - jobSucceeded   : a single-command job that completed cleanly.
//   - jobFailed      : a single-command job that failed.
//
// Per-command fixtures use emission shapes captured from real runs so that
// mock mode renders identically to a live server.

const inProgressUmbrellaId        = "00000000-0000-4000-8000-000000000001"
const inProgressRunningStepId     = "00000000-0000-4000-8000-000000000002"
const inProgressPendingStepId     = "00000000-0000-4000-8000-000000000003"
const succeededJobId              = "00000000-0000-4000-8000-000000000010"
const failedJobId                 = "00000000-0000-4000-8000-000000000020"
const nameSpecialFeaturesJobId    = "00000000-0000-4000-8000-000000000030"
const keepLanguagesJobId          = "00000000-0000-4000-8000-000000000031"
const copyFilesJobId              = "00000000-0000-4000-8000-000000000032"
const extractSubtitlesJobId       = "00000000-0000-4000-8000-000000000033"
const deleteFilesByExtensionJobId = "00000000-0000-4000-8000-000000000034"
const modifySubtitleMetadataJobId = "00000000-0000-4000-8000-000000000035"
const mergeTracksJobId            = "00000000-0000-4000-8000-000000000036"
const deleteFolderJobId           = "00000000-0000-4000-8000-000000000037"

export const mockJobIds = {
  inProgressUmbrellaId,
  inProgressRunningStepId,
  inProgressPendingStepId,
  succeededJobId,
  failedJobId,
  nameSpecialFeaturesJobId,
  keepLanguagesJobId,
  copyFilesJobId,
  extractSubtitlesJobId,
  deleteFilesByExtensionJobId,
  modifySubtitleMetadataJobId,
  mergeTracksJobId,
  deleteFolderJobId,
}

// Maps command name → its fixture job ID so POST /commands/:name returns a
// command-specific job with realistic result shapes.
export const commandJobMap = {
  nameSpecialFeatures:    nameSpecialFeaturesJobId,
  keepLanguages:          keepLanguagesJobId,
  copyFiles:              copyFilesJobId,
  extractSubtitles:       extractSubtitlesJobId,
  deleteFilesByExtension: deleteFilesByExtensionJobId,
  modifySubtitleMetadata: modifySubtitleMetadataJobId,
  mergeTracks:            mergeTracksJobId,
  deleteFolder:           deleteFolderJobId,
}

const nowIso = () => new Date().toISOString()
const ago = (ms) => new Date(Date.now() - ms).toISOString()

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
        { id: "step2", command: "renameDemos",      params: { sourcePath: "@source" } },
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
    startedAt: ago(90_000),
    completedAt: ago(60_000),
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
    startedAt: ago(45_000),
    completedAt: ago(40_000),
    parentJobId: null,
    stepId: null,
  },

  // ── nameSpecialFeatures ──────────────────────────────────────────────────
  // Emits per-file: collision objects, rename objects, then one prompt object
  // for any files the disc DB couldn't auto-match.
  // Collision shape: 5 total, 3 sharing the same targetFilename so the UI's
  // "multiple sources → one destination" conflict path gets exercised.
  {
    id: nameSpecialFeaturesJobId,
    commandName: "nameSpecialFeatures",
    status: "completed",
    params: { sourcePath: "C:\\fake\\Disc-Rips\\SOME MOVIE - 4K", dvdCompareId: 12345, fixedOffset: 0, timecodePadding: 2 },
    results: [
      // 3 collisions all targeting the same name
      { collision: true, filename: "MOVIE_t01.mkv", targetFilename: "Behind the Scenes -featurette" },
      { collision: true, filename: "MOVIE_t02.mkv", targetFilename: "Behind the Scenes -featurette" },
      { collision: true, filename: "MOVIE_t03.mkv", targetFilename: "Behind the Scenes -featurette" },
      // 2 more collisions with distinct targets
      { collision: true, filename: "MOVIE_t04.mkv", targetFilename: "Theatrical Trailer -trailer" },
      { collision: true, filename: "MOVIE_t05.mkv", targetFilename: "Director's Commentary -other" },
      // Successful renames
      { oldName: "MOVIE_t06.mkv", newName: "Making Of The Film -featurette" },
      { oldName: "MOVIE_t07.mkv", newName: "Deleted Scenes -deleted" },
      {
        unrenamedFilenames: ["MOVIE_t08.mkv", "MOVIE_t09.mkv"],
        possibleNames: [
          { name: "Image Gallery" },
          { name: "The Making of Inception" },
        ],
        allKnownNames: [
          "Behind the Scenes", "Theatrical Trailer", "Director's Commentary",
          "Making Of The Film", "Deleted Scenes", "Image Gallery",
          "The Making of Inception",
        ],
        unnamedFileCandidates: [
          { filename: "MOVIE_t08.mkv", candidates: ["Image Gallery", "The Making of Inception", "Behind the Scenes"] },
          { filename: "MOVIE_t09.mkv", candidates: ["The Making of Inception", "Image Gallery"] },
        ],
      },
    ],
    outputs: null,
    error: null,
    startedAt: ago(30_000),
    completedAt: ago(5_000),
    parentJobId: null,
    stepId: null,
  },

  // ── keepLanguages ────────────────────────────────────────────────────────
  // Emits one array containing all files marked TRASH (language-stripped copies).
  {
    id: keepLanguagesJobId,
    commandName: "keepLanguages",
    status: "completed",
    params: { sourcePath: "C:\\fake\\show\\work\\LANGUAGE-TRIMMED" },
    results: [
      [
        "C:\\fake\\show\\work\\LANGUAGE-TRIMMED\\Show - s01e01 - TRASH.mkv",
        "C:\\fake\\show\\work\\LANGUAGE-TRIMMED\\Show - s01e02 - TRASH.mkv",
        "C:\\fake\\show\\work\\LANGUAGE-TRIMMED\\Show - s01e03 - TRASH.mkv",
      ],
    ],
    outputs: null,
    error: null,
    startedAt: ago(20_000),
    completedAt: ago(15_000),
    parentJobId: null,
    stepId: null,
  },

  // ── copyFiles ────────────────────────────────────────────────────────────
  // Emits one string per file as it finishes copying (destination path).
  {
    id: copyFilesJobId,
    commandName: "copyFiles",
    status: "completed",
    params: { sourcePath: "C:\\fake\\show\\work" },
    results: [
      "C:\\fake\\show\\Show - s01e01 - TRASH.mkv",
      "C:\\fake\\show\\Show - s01e02 - TRASH.mkv",
      "C:\\fake\\show\\Show - s01e03 - TRASH.mkv",
    ],
    outputs: null,
    error: null,
    startedAt: ago(18_000),
    completedAt: ago(14_000),
    parentJobId: null,
    stepId: null,
  },

  // ── extractSubtitles ─────────────────────────────────────────────────────
  // Emits one array containing all extracted subtitle file paths.
  {
    id: extractSubtitlesJobId,
    commandName: "extractSubtitles",
    status: "completed",
    params: { sourcePath: "C:\\fake\\show\\work" },
    results: [
      [
        "C:\\fake\\show\\work\\EXTRACTED-SUBTITLES\\Show - s01e01 - TRASH\\track2.eng.ass",
        "C:\\fake\\show\\work\\EXTRACTED-SUBTITLES\\Show - s01e01 - TRASH\\track3.eng.ass",
        "C:\\fake\\show\\work\\EXTRACTED-SUBTITLES\\Show - s01e02 - TRASH\\track2.eng.ass",
        "C:\\fake\\show\\work\\EXTRACTED-SUBTITLES\\Show - s01e02 - TRASH\\track3.eng.ass",
        "C:\\fake\\show\\work\\EXTRACTED-SUBTITLES\\Show - s01e03 - TRASH\\track2.eng.ass",
      ],
    ],
    outputs: null,
    error: null,
    startedAt: ago(16_000),
    completedAt: ago(12_000),
    parentJobId: null,
    stepId: null,
  },

  // ── deleteFilesByExtension ───────────────────────────────────────────────
  // Emits one string per file deleted.
  {
    id: deleteFilesByExtensionJobId,
    commandName: "deleteFilesByExtension",
    status: "completed",
    params: { sourcePath: "C:\\fake\\show\\work\\EXTRACTED-SUBTITLES", extension: ".srt" },
    results: [
      "C:\\fake\\show\\work\\EXTRACTED-SUBTITLES\\Show - s01e01 - TRASH\\track4.eng.srt",
      "C:\\fake\\show\\work\\EXTRACTED-SUBTITLES\\Show - s01e02 - TRASH\\track4.eng.srt",
    ],
    outputs: null,
    error: null,
    startedAt: ago(11_000),
    completedAt: ago(10_000),
    parentJobId: null,
    stepId: null,
  },

  // ── modifySubtitleMetadata ───────────────────────────────────────────────
  // Emits {filePath} per processed subtitle file.
  {
    id: modifySubtitleMetadataJobId,
    commandName: "modifySubtitleMetadata",
    status: "completed",
    params: { sourcePath: "C:\\fake\\show\\work\\EXTRACTED-SUBTITLES" },
    results: [
      { filePath: "C:\\fake\\show\\work\\EXTRACTED-SUBTITLES\\Show - s01e01 - TRASH\\track2.eng.ass" },
      { filePath: "C:\\fake\\show\\work\\EXTRACTED-SUBTITLES\\Show - s01e01 - TRASH\\track3.eng.ass" },
      { filePath: "C:\\fake\\show\\work\\EXTRACTED-SUBTITLES\\Show - s01e02 - TRASH\\track2.eng.ass" },
      { filePath: "C:\\fake\\show\\work\\EXTRACTED-SUBTITLES\\Show - s01e02 - TRASH\\track3.eng.ass" },
      { filePath: "C:\\fake\\show\\work\\EXTRACTED-SUBTITLES\\Show - s01e03 - TRASH\\track2.eng.ass" },
    ],
    outputs: null,
    error: null,
    startedAt: ago(10_000),
    completedAt: ago(8_000),
    parentJobId: null,
    stepId: null,
  },

  // ── mergeTracks ──────────────────────────────────────────────────────────
  // Emits one array containing all muxed output file paths.
  {
    id: mergeTracksJobId,
    commandName: "mergeTracks",
    status: "completed",
    params: { sourcePath: "C:\\fake\\show\\work" },
    results: [
      [
        "C:\\fake\\show\\work\\SUBTITLED\\Show - s01e01 - TRASH.mkv",
        "C:\\fake\\show\\work\\SUBTITLED\\Show - s01e02 - TRASH.mkv",
        "C:\\fake\\show\\work\\SUBTITLED\\Show - s01e03 - TRASH.mkv",
      ],
    ],
    outputs: null,
    error: null,
    startedAt: ago(8_000),
    completedAt: ago(3_000),
    parentJobId: null,
    stepId: null,
  },

  // ── deleteFolder ─────────────────────────────────────────────────────────
  // Emits the path of the deleted folder as a single string.
  {
    id: deleteFolderJobId,
    commandName: "deleteFolder",
    status: "completed",
    params: { sourcePath: "C:\\fake\\show\\work" },
    results: ["C:\\fake\\show\\work"],
    outputs: null,
    error: null,
    startedAt: ago(3_000),
    completedAt: ago(1_000),
    parentJobId: null,
    stepId: null,
  },
]

// Buffered log lines per job for /jobs/:id/logs replay.
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
  [nameSpecialFeaturesJobId]: [
    "Loading DVDCompare page…",
    "Scraped extras text: 1494 chars, 27 non-empty lines",
    "Parsed 11 extras (23 with timecodes), 0 cuts, 4 untimed suggestions",
    "Reading file metadata… (padding=2, offset=0)",
    "  MOVIE_t01.mkv: 6:36",
    "  MOVIE_t02.mkv: 6:31",
    "  MOVIE_t03.mkv: 6:29",
    "  MOVIE_t04.mkv: 1:50",
    "  MOVIE_t05.mkv: 4:27",
    "  MOVIE_t06.mkv: 11:50",
    "  MOVIE_t07.mkv: 0:48",
    "  MOVIE_t08.mkv: 14:57",
    "  MOVIE_t09.mkv: 2:34",
    "Collision: MOVIE_t01.mkv → Behind the Scenes -featurette already exists",
    "Collision: MOVIE_t02.mkv → Behind the Scenes -featurette already exists",
    "Collision: MOVIE_t03.mkv → Behind the Scenes -featurette already exists",
    "Collision: MOVIE_t04.mkv → Theatrical Trailer -trailer already exists",
    "Collision: MOVIE_t05.mkv → Director's Commentary -other already exists",
    "Renamed: MOVIE_t06.mkv → Making Of The Film -featurette",
    "Renamed: MOVIE_t07.mkv → Deleted Scenes -deleted",
    "Prompt: 2 files could not be matched automatically",
  ],
  [keepLanguagesJobId]: [
    "Scanning C:\\fake\\show\\work\\LANGUAGE-TRIMMED…",
    "Found 3 files",
    "Trimming languages — keeping: jpn, eng",
    "  Show - s01e01.mkv → TRASH",
    "  Show - s01e02.mkv → TRASH",
    "  Show - s01e03.mkv → TRASH",
    "Done. 3 files marked for removal.",
  ],
  [copyFilesJobId]: [
    "Scanning C:\\fake\\show\\work…",
    "Found 3 files",
    "Copying Show - s01e01 - TRASH.mkv → C:\\fake\\show\\",
    "Copying Show - s01e02 - TRASH.mkv → C:\\fake\\show\\",
    "Copying Show - s01e03 - TRASH.mkv → C:\\fake\\show\\",
    "Done. 3 files copied.",
  ],
  [extractSubtitlesJobId]: [
    "Scanning C:\\fake\\show\\work…",
    "Found 3 MKV files with embedded subtitles",
    "Extracting Show - s01e01 - TRASH.mkv (2 tracks)",
    "Extracting Show - s01e02 - TRASH.mkv (2 tracks)",
    "Extracting Show - s01e03 - TRASH.mkv (1 track)",
    "Done. 5 subtitle files extracted.",
  ],
  [deleteFilesByExtensionJobId]: [
    "Scanning C:\\fake\\show\\work\\EXTRACTED-SUBTITLES for *.srt…",
    "Found 2 files",
    "Deleted track4.eng.srt (Show - s01e01)",
    "Deleted track4.eng.srt (Show - s01e02)",
    "Done.",
  ],
  [modifySubtitleMetadataJobId]: [
    "Scanning C:\\fake\\show\\work\\EXTRACTED-SUBTITLES…",
    "Found 5 ASS files",
    "Processing Show - s01e01 - TRASH\\track2.eng.ass",
    "Processing Show - s01e01 - TRASH\\track3.eng.ass",
    "Processing Show - s01e02 - TRASH\\track2.eng.ass",
    "Processing Show - s01e02 - TRASH\\track3.eng.ass",
    "Processing Show - s01e03 - TRASH\\track2.eng.ass",
    "Done.",
  ],
  [mergeTracksJobId]: [
    "Scanning C:\\fake\\show\\work…",
    "Found 3 source MKV + subtitle pairs",
    "Muxing Show - s01e01 - TRASH.mkv",
    "Muxing Show - s01e02 - TRASH.mkv",
    "Muxing Show - s01e03 - TRASH.mkv",
    "Done. 3 files muxed.",
  ],
  [deleteFolderJobId]: [
    "Deleting C:\\fake\\show\\work…",
    "Done.",
  ],
}

// Shape mirrors the real /files/list response (see schemas.ts:
// listFilesResponseSchema).
export const mockFilesList = {
  entries: [
    { name: "Movies",    isFile: false, isDirectory: true,  size: 0,             mtime: nowIso(), duration: null },
    { name: "TV Shows",  isFile: false, isDirectory: true,  size: 0,             mtime: nowIso(), duration: null },
    { name: "demo.mkv",  isFile: true,  isDirectory: false, size: 1_500_000_000, mtime: nowIso(), duration: "1:45:12" },
    { name: "trailer.mp4", isFile: true, isDirectory: false, size: 80_000_000,   mtime: nowIso(), duration: "2:30" },
  ],
  separator: "\\",
  error: null,
}

// Builder typeahead (see schemas.listDirectoryEntriesResponseSchema).
export const mockDirectoryEntries = {
  entries: [
    { name: "Movies",   isDirectory: true },
    { name: "TV Shows", isDirectory: true },
    { name: "demo.mkv", isDirectory: false },
  ],
  separator: "\\",
  error: null,
}

// Stub responses for the Builder's lookup queries.
export const mockSearchMalResults = {
  results: [
    { malId: 1, name: "Cowboy Bebop", airDate: "1998", mediaType: "TV", imageUrl: "" },
    { malId: 2, name: "Trigun",       airDate: "1998", mediaType: "TV", imageUrl: "" },
  ],
  error: null,
}
