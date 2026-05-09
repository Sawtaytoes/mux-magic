import { type Observable } from "rxjs"
import { type Context } from "hono"

import {
  type CommandConfig,
  type CommandName,
  commandConfigs as realCommandConfigs,
  commandNames,
} from "../api/routes/commandRoutes.js"
import { failureScenario } from "./scenarios/failure.js"
import { getAudioOffsetsScenario } from "./scenarios/getAudioOffsets.js"
import { inProgressScenario } from "./scenarios/inProgress.js"
import { nameSpecialFeaturesScenario } from "./scenarios/nameSpecialFeatures.js"
import {
  nameAnimeEpisodesAniDBScenario,
  nameAnimeEpisodesScenario,
  nameTvShowEpisodesScenario,
  renameDemosScenario,
  renameMovieClipDownloadsScenario,
} from "./scenarios/renameCommands.js"
import { replaceFlacWithPcmAudioScenario } from "./scenarios/replaceFlacWithPcmAudio.js"
import { storeAspectRatioDataScenario } from "./scenarios/storeAspectRatioData.js"
import { successScenario } from "./scenarios/success.js"

// Recognize all fake-mode values: "1"/"true"/"yes" for default (success),
// "failure"/"fail" for scripted-error mode, "inProgress" for stuck mode.
const isFakeQuery = (raw: string | undefined): boolean => {
  if (!raw) return false
  const lowered = raw.toLowerCase()
  return (
    lowered === "1" || lowered === "true" || lowered === "yes"
    || lowered === "failure" || lowered === "fail"
    || lowered === "inprogress" || lowered === "progress"
  )
}

// Detect whether THIS request should use fake responses via `?fake=1`.
export const isFakeRequest = (context: Context): boolean => (
  isFakeQuery(context.req.query("fake"))
)

// Returns the global scenario override requested by this fake call.
// null means "use per-command defaults" (the normal success path).
// Called by route handlers alongside isFakeRequest so they can forward
// the scenario to getEffectiveCommandConfigs / runSequenceJob.
export const getFakeScenario = (context: Context): Scenario | null => {
  const raw = context.req.query("fake")
  if (!raw) return null
  const lowered = raw.toLowerCase()
  if (lowered === "failure" || lowered === "fail") return "failure"
  if (lowered === "inprogress" || lowered === "progress") return "inProgress"
  return null
}

// ---------------------------------------------------------------------------
// Fake commandConfigs map
//
// We keep the same keys / schemas / metadata as the real config so the
// route layer (OpenAPI registration, params validation, outputFolderName
// fallback, deprecated badge) stays untouched — only `getObservable` /
// `extractOutputs` change. The scenario picked per command is a stable
// rotation across success/failure/in-progress, so a sequence with a few
// steps will hit at least one of each.
// ---------------------------------------------------------------------------

export type Scenario = "success" | "failure" | "inProgress"

// Hand-picked rotation: the first three commands are pinned to the
// canonical scenarios (so a smoke test always hits all three) and the
// rest cycle deterministically. Pinning specific names makes manual
// testing predictable: makeDirectory always succeeds, modifySubtitleMetadata
// always fails, copyOutSubtitles always stays in-flight.
// In dry-run mode all commands default to success — failure injection is
// opt-in via the UI's "Failure mode" toggle (which appends ?fake=failure).
// Only copyOutSubtitles stays pinned to inProgress as the smoke-test
// target for the cancelled/stuck UI state.
const SCENARIO_OVERRIDES: Partial<Record<CommandName, Scenario>> = {
  makeDirectory: "success",
  modifySubtitleMetadata: "success",
  copyOutSubtitles: "inProgress",
}

// Per-command observable factories that bypass the generic scenario
// rotation entirely. Each factory receives the same (body, options)
// signature as the scenario helpers so it can log, emit progress, and
// call getUserSearchInput for interactive prompts — exactly as the real
// command would, but with canned data and no filesystem or network I/O.
type ObservableFactory = (body: unknown, options: { label?: string }) => Observable<unknown>

const OBSERVABLE_OVERRIDES: Partial<Record<CommandName, ObservableFactory>> = {
  getAudioOffsets: getAudioOffsetsScenario,
  nameAnimeEpisodes: nameAnimeEpisodesScenario,
  nameAnimeEpisodesAniDB: nameAnimeEpisodesAniDBScenario,
  nameSpecialFeatures: nameSpecialFeaturesScenario,
  nameTvShowEpisodes: nameTvShowEpisodesScenario,
  renameDemos: renameDemosScenario,
  renameMovieClipDownloads: renameMovieClipDownloadsScenario,
  replaceFlacWithPcmAudio: replaceFlacWithPcmAudioScenario,
  storeAspectRatioData: storeAspectRatioDataScenario,
}

// Default rotation is all-success. Failure injection is opt-in through the
// UI's "Failure mode" toggle (sets ?fake=failure on fetches). This keeps
// dry-run from unexpectedly blocking a sequence with a scripted failure.
const ROTATION: readonly Scenario[] = ["success", "success", "success", "success", "success"]

// totalMs overrides for the success scenario. Commands are grouped by
// their real-world I/O profile so the dry-run timing feels proportional.
// Commands not listed here use successScenario's 4 s default.
const TIMING_OVERRIDES: Partial<Record<CommandName, number>> = {
  // Filesystem renames / deletes — effectively instant
  makeDirectory: 400,
  deleteFilesByExtension: 400,
  deleteFolder: 400,
  moveFiles: 800,
  flattenOutput: 800,
  // Subtitle metadata — small ASS files, fast JSON rewrite
  modifySubtitleMetadata: 900,
  // Metadata checks — fast scan, no heavy I/O
  hasBetterAudio: 700,
  hasBetterVersion: 700,
  hasDuplicateMusicFiles: 700,
  hasImaxEnhancedAudio: 700,
  hasManyAudioTracks: 700,
  hasSurroundSound: 700,
  hasWrongDefaultTrack: 700,
  isMissingSubtitles: 700,
}

const scenarioForCommand = (
  command: CommandName,
  index: number,
): Scenario => (
  SCENARIO_OVERRIDES[command]
  ?? ROTATION[index % ROTATION.length]
)

const buildFakeConfig = (
  command: CommandName,
  scenario: Scenario,
  bypassOverrides = false,
): CommandConfig => {
  const real = realCommandConfigs[command]
  const label = `fake/${command}`

  const customFactory = bypassOverrides ? undefined : OBSERVABLE_OVERRIDES[command]

  const getObservable = (body: unknown) => {
    if (customFactory) return customFactory(body, { label })
    if (scenario === "failure") {
      return failureScenario(body, { label })
    }
    if (scenario === "inProgress") {
      return inProgressScenario(body, { label })
    }
    return successScenario(body, { label, totalMs: TIMING_OVERRIDES[command] })
  }

  return {
    ...real,
    getObservable,
    // For commands that declare `extractOutputs`, keep a fake projector
    // so a downstream linkedTo step still resolves. Other commands
    // inherit the absent extractOutputs.
    ...(real.extractOutputs
      ? {
          extractOutputs: (results: unknown[]) => ({
            rules: results,
            fakeOutput: true,
          }),
        }
      : {}),
  }
}

let memoizedFakeConfigs: Record<CommandName, CommandConfig> | null = null

export const getFakeCommandConfigs = (): Record<CommandName, CommandConfig> => {
  if (memoizedFakeConfigs) return memoizedFakeConfigs
  const map = {} as Record<CommandName, CommandConfig>
  commandNames.forEach((name, index) => {
    map[name] = buildFakeConfig(name, scenarioForCommand(name, index))
  })
  memoizedFakeConfigs = map
  return map
}

// Resolves which `commandConfigs` map a caller should use.
// `globalScenario` is non-null only when the request carries
// `?fake=failure` or `?fake=inProgress` — it overrides every command's
// scenario uniformly, bypassing OBSERVABLE_OVERRIDES so the whole
// sequence behaves predictably (all fail, or all stay in-flight).
export const getEffectiveCommandConfigs = (
  useFake: boolean,
  globalScenario?: Scenario | null,
): Record<CommandName, CommandConfig> => {
  if (!useFake) return realCommandConfigs
  if (!globalScenario) return getFakeCommandConfigs()
  // Global override — build fresh (not memoized; only used for the
  // opt-in failure/inProgress modes, not the default success path).
  const map = {} as Record<CommandName, CommandConfig>
  commandNames.forEach((name) => {
    map[name] = buildFakeConfig(name, globalScenario, true)
  })
  return map
}

// ---------------------------------------------------------------------------
// Canned read-only data for /files, /inputs, /queries
//
// These return shapes match the response schemas declared in
// `src/api/schemas.ts`. The point is full UI parity for the Builder's
// param dropdowns — a designer running with --fake-data should be able
// to pick a path, an MAL ID, and a TVDB ID without a real filesystem
// or network connection.
// ---------------------------------------------------------------------------

const SEPARATOR = "/"

export const fakeListFiles = () => ({
  separator: SEPARATOR,
  error: null,
  entries: [
    { name: "Anime", isDirectory: true, isFile: false, size: 0, mtime: new Date().toISOString(), duration: null },
    { name: "Movies", isDirectory: true, isFile: false, size: 0, mtime: new Date().toISOString(), duration: null },
    { name: "TV Shows", isDirectory: true, isFile: false, size: 0, mtime: new Date().toISOString(), duration: null },
    { name: "fake-episode-01.mkv", isDirectory: false, isFile: true, size: 1024 * 1024 * 350, mtime: new Date().toISOString(), duration: "23:45" },
    { name: "fake-episode-02.mkv", isDirectory: false, isFile: true, size: 1024 * 1024 * 360, mtime: new Date().toISOString(), duration: "23:50" },
  ],
})

export const fakeListDirectoryEntries = () => ({
  separator: SEPARATOR,
  error: null,
  entries: [
    { name: "fake-folder-a", isDirectory: true },
    { name: "fake-folder-b", isDirectory: true },
    { name: "fake-file-01.mkv", isDirectory: false },
    { name: "fake-file-02.mkv", isDirectory: false },
  ],
})

export const fakeDefaultPath = () => ({ path: "/fake/home" })

export const fakeDeleteMode = () => ({
  mode: "trash" as const,
  reason: null as string | null,
})

// Search results — three canned entries each, enough to populate a
// dropdown with selectable options.

export const fakeSearchMal = () => ({
  results: [
    { malId: 1, name: "Cowboy Bebop", mediaType: "TV" },
    { malId: 5114, name: "Fullmetal Alchemist: Brotherhood", mediaType: "TV" },
    { malId: 9253, name: "Steins;Gate", mediaType: "TV" },
  ],
  error: null,
})

export const fakeSearchAnidb = () => ({
  results: [
    { aid: 1, name: "Cowboy Bebop", type: "TV", episodes: 26 },
    { aid: 23, name: "Cowboy Bebop: Tengoku no Tobira", type: "MOVIE", episodes: 1 },
    { aid: 6107, name: "Fullmetal Alchemist: Brotherhood", type: "TV", episodes: 64 },
  ],
  error: null,
})

export const fakeSearchTvdb = () => ({
  results: [
    { tvdbId: 70327, name: "Buffy the Vampire Slayer", year: "1997", status: "Ended" },
    { tvdbId: 75760, name: "Lost", year: "2004", status: "Ended" },
    { tvdbId: 121361, name: "Game of Thrones", year: "2011", status: "Ended" },
  ],
  error: null,
})

export const fakeSearchMovieDb = () => ({
  results: [
    { movieDbId: 27205, title: "Inception", year: "2010", overview: "A thief who steals corporate secrets..." },
    { movieDbId: 603, title: "The Matrix", year: "1999", overview: "A computer hacker learns..." },
    { movieDbId: 78, title: "Blade Runner", year: "1982", overview: "A blade runner must pursue..." },
  ],
  error: null,
})

export const fakeSearchDvdCompare = () => ({
  results: [
    { id: 12345, baseTitle: "The Matrix", variant: "Blu-ray 4K" as const, year: "1999" },
    { id: 12346, baseTitle: "The Matrix", variant: "Blu-ray" as const, year: "1999" },
    { id: 12347, baseTitle: "The Matrix", variant: "DVD" as const, year: "1999" },
  ],
  error: null,
})

export const fakeListDvdCompareReleases = () => ({
  releases: [
    { hash: "fake-release-aaaaa", label: "Blu-ray ALL America - Warner - Standard Edition" },
    { hash: "fake-release-bbbbb", label: "Blu-ray ALL America - Warner - Steelbook Edition" },
    { hash: "fake-release-ccccc", label: "Blu-ray UK - Arrow Films - Limited Edition" },
  ],
  error: null,
})

export const fakeNameLookup = () => ({ name: "Fake Series Name" })
export const fakeLabelLookup = () => ({ label: "Fake Release Label" })

export const fakeGetSubtitleMetadata = () => ({
  subtitlesMetadata: [
    {
      filePath: "/fake/path/to/episode-01.ass",
      scriptInfo: {
        Title: "Fake Episode 1",
        ScriptType: "v4.00+",
        PlayResX: "1920",
        PlayResY: "1080",
      },
      styles: [
        { Name: "Default", Fontsize: "60", Alignment: "2" },
        { Name: "Sign", Fontsize: "48", Alignment: "5" },
      ],
    },
  ],
})
