import { type Context } from "hono"

import {
  type CommandConfig,
  type CommandName,
  commandConfigs as realCommandConfigs,
  commandNames,
} from "../api/routes/commandRoutes.js"
import { failureScenario } from "./scenarios/failure.js"
import { inProgressScenario } from "./scenarios/inProgress.js"
import { successScenario } from "./scenarios/success.js"

// ---------------------------------------------------------------------------
// Server-level flag — set once at boot from the --fake-data CLI arg or the
// MEDIA_TOOLS_FAKE_DATA env var. When true, every route handler treats every
// request as fake without needing the per-request ?fake=1 query string.
// ---------------------------------------------------------------------------

let serverFakeMode = false

export const setFakeModeEnabled = (enabled: boolean): void => {
  serverFakeMode = enabled
}

export const isFakeModeEnabled = (): boolean => (
  serverFakeMode
)

// Per-request opt-in via `?fake=1`. The truthy values mirror what feels
// natural in a URL — `1`, `true`, `yes`. Any other value (including
// missing) is treated as off.
const isFakeQuery = (raw: string | undefined): boolean => {
  if (!raw) return false
  const lowered = raw.toLowerCase()
  return lowered === "1" || lowered === "true" || lowered === "yes"
}

// Detect whether THIS request should use fake responses. Honors both
// the server flag (always-on) and the per-request `?fake=1` query so
// fake jobs can run alongside real ones on the same server instance.
export const isFakeRequest = (context: Context): boolean => (
  serverFakeMode
  || isFakeQuery(context.req.query("fake"))
)

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

type Scenario = "success" | "failure" | "inProgress"

// Hand-picked rotation: the first three commands are pinned to the
// canonical scenarios (so a smoke test always hits all three) and the
// rest cycle deterministically. Pinning specific names makes manual
// testing predictable: makeDirectory always succeeds, computeDefaultSubtitleRules
// always fails, copyOutSubtitles always stays in-flight.
const SCENARIO_OVERRIDES: Partial<Record<CommandName, Scenario>> = {
  makeDirectory: "success",
  computeDefaultSubtitleRules: "failure",
  copyOutSubtitles: "inProgress",
}

const ROTATION: readonly Scenario[] = ["success", "success", "failure", "success", "inProgress"]

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
): CommandConfig => {
  const real = realCommandConfigs[command]
  const label = `fake/${command}`

  const getObservable = (body: unknown) => {
    if (scenario === "failure") {
      return failureScenario(body, { label })
    }
    if (scenario === "inProgress") {
      return inProgressScenario(body, { label })
    }
    return successScenario(body, { label })
  }

  return {
    ...real,
    getObservable,
    // For commands that declare `extractOutputs` (currently just
    // computeDefaultSubtitleRules → rules), keep a fake projector so a
    // downstream linkedTo:rules step still resolves. Other commands
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

// Resolves which `commandConfigs` map a caller should use. Routes /
// the sequence runner pass a `useFake` boolean derived from
// `isFakeRequest(context)` (per-request) or `isFakeModeEnabled()`
// (server-instance) and get the right map back.
export const getEffectiveCommandConfigs = (
  useFake: boolean,
): Record<CommandName, CommandConfig> => (
  useFake
  ? getFakeCommandConfigs()
  : realCommandConfigs
)

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
