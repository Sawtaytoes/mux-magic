#!/usr/bin/env node

/**
 * Generates parity reference YAML + input.json for every command in commands.js.
 *
 * Phase 0 (W0c): captures baseline fixtures while legacy JS still works.
 * Phase 4 (W4): re-run after migration; output must match baseline byte-for-byte.
 *   After W1 lands, swap the COMMANDS import to ../src/commands/commands.ts.
 *
 * Run: yarn workspace @mux-magic/web tsx scripts/capture-parity-fixtures.ts
 */

import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { dump } from "js-yaml"

const scriptDir = dirname(fileURLToPath(import.meta.url))
const outputDir = join(
  scriptDir,
  "../tests/fixtures/parity",
)
mkdirSync(outputDir, { recursive: true })

// ─── Types ────────────────────────────────────────────────────────────────────

type CommandField = {
  name: string
  type: string
  label?: string
  required?: boolean
  default?: unknown
  companionNameField?: string
}

type CommandDefinition = {
  fields: CommandField[]
  persistedKeys?: string[]
}

type StepLink =
  | string
  | { linkedTo: string; output: string }

type FixtureStep = {
  id: string
  command: string
  params: Record<string, unknown>
  links: Record<string, StepLink>
}

type PathVariable = {
  id: string
  label: string
  value: string
}

type FixtureInput = {
  paths: PathVariable[]
  step: FixtureStep
}

// ─── COMMANDS import (TS port — updated from legacy JS in Phase 4 / W4A) ───
import { COMMANDS } from "../src/commands/commands"

// ─── buildParams (ported verbatim from sequence-editor.js ~line 723) ─────────
// resolveLinks=false behavior: string links become "@id"; object links pass through.

const buildParams = (
  step: FixtureStep,
  commandDefinition: CommandDefinition,
): Record<string, unknown> => {
  const result: Record<string, unknown> = {}

  commandDefinition.fields.forEach((field) => {
    const baseValue = step.params[field.name]
    const link = step.links?.[field.name]
    const resolvedValue = (() => {
      if (!link) {
        return baseValue
      }
      if (typeof link === "string") {
        return `@${link}`
      }
      if (
        link &&
        typeof link === "object" &&
        (link as { linkedTo: string }).linkedTo
      ) {
        return {
          linkedTo: (
            link as { linkedTo: string; output: string }
          ).linkedTo,
          output:
            (link as { linkedTo: string; output: string })
              .output || "folder",
        }
      }
      return baseValue
    })()

    const skipPrimary =
      resolvedValue === undefined ||
      resolvedValue === null ||
      resolvedValue === "" ||
      (Array.isArray(resolvedValue) &&
        resolvedValue.length === 0) ||
      (!field.required &&
        field.default !== undefined &&
        resolvedValue === field.default)

    if (!skipPrimary) {
      result[field.name] = resolvedValue
    }

    if (field.companionNameField) {
      const companionValue =
        step.params[field.companionNameField]
      if (
        companionValue !== undefined &&
        companionValue !== null &&
        companionValue !== ""
      ) {
        result[field.companionNameField] = companionValue
      }
    }
  })

  if (Array.isArray(commandDefinition.persistedKeys)) {
    commandDefinition.persistedKeys.forEach(
      (persistedKey) => {
        const persistedValue = step.params[persistedKey]
        if (
          persistedValue !== undefined &&
          persistedValue !== null &&
          persistedValue !== ""
        ) {
          result[persistedKey] = persistedValue
        }
      },
    )
  }

  return result
}

// ─── YAML serializer (matches yamlSerializer.ts options exactly) ─────────────

const buildYaml = (
  step: FixtureStep,
  resolvedParams: Record<string, unknown>,
  paths: PathVariable[],
): string => {
  const pathsObj = Object.fromEntries(
    paths.map((pathVariable) => [
      pathVariable.id,
      {
        label: pathVariable.label,
        value: pathVariable.value,
      },
    ]),
  )
  return dump(
    {
      paths: pathsObj,
      steps: [
        {
          id: step.id,
          command: step.command,
          params: resolvedParams,
        },
      ],
    },
    { lineWidth: -1, flowLevel: 3, indent: 2 },
  )
}

// ─── Fixture input factory ────────────────────────────────────────────────────

const BASE_PATHS: PathVariable[] = [
  {
    id: "basePath",
    label: "Base Path",
    value: "/fixture/media",
  },
]

const makeStep = (
  command: string,
  params: Record<string, unknown>,
  links: Record<string, StepLink> = {},
): FixtureStep => ({
  id: "step-fixture",
  command,
  params,
  links,
})

// ─── Per-command fixture inputs ───────────────────────────────────────────────
// Values are realistic-but-deterministic.
// Required path fields are linked to basePath (→ "@basePath" in YAML).
// Optional boolean fields are set to their non-default value so they appear.
// Optional numeric fields are set to non-default values for the same reason.
// This exercises every code path in buildParams for each command.

const FIXTURE_INPUTS: Record<string, FixtureInput> = {
  // ── File Operations ─────────────────────────────────────────────────────────
  makeDirectory: {
    paths: BASE_PATHS,
    step: makeStep(
      "makeDirectory",
      {},
      { sourcePath: "basePath" },
    ),
  },
  copyFiles: {
    paths: BASE_PATHS,
    step: makeStep(
      "copyFiles",
      {},
      {
        sourcePath: "basePath",
        destinationPath: "basePath",
      },
    ),
  },
  flattenOutput: {
    paths: BASE_PATHS,
    step: makeStep(
      "flattenOutput",
      { deleteSourceFolder: true },
      { sourcePath: "basePath" },
    ),
  },
  moveFiles: {
    paths: BASE_PATHS,
    step: makeStep(
      "moveFiles",
      {},
      {
        sourcePath: "basePath",
        destinationPath: "basePath",
      },
    ),
  },
  replaceAttachments: {
    paths: BASE_PATHS,
    step: makeStep(
      "replaceAttachments",
      {},
      {
        sourcePath: "basePath",
        destinationFilesPath: "basePath",
      },
    ),
  },
  deleteFilesByExtension: {
    paths: BASE_PATHS,
    step: makeStep(
      "deleteFilesByExtension",
      {
        extensions: [".srt", ".idx"],
        isRecursive: true,
        recursiveDepth: 2,
      },
      { sourcePath: "basePath" },
    ),
  },
  deleteFolder: {
    paths: BASE_PATHS,
    step: makeStep(
      "deleteFolder",
      { confirm: true },
      { sourcePath: "basePath" },
    ),
  },
  splitChapters: {
    paths: BASE_PATHS,
    step: makeStep(
      "splitChapters",
      { chapterSplits: ["ch1", "ch2"] },
      { sourcePath: "basePath" },
    ),
  },
  remuxToMkv: {
    paths: BASE_PATHS,
    step: makeStep(
      "remuxToMkv",
      {
        extensions: [".ts", ".m2ts"],
        isRecursive: true,
        recursiveDepth: 2,
        isSourceDeletedOnSuccess: true,
      },
      { sourcePath: "basePath" },
    ),
  },
  // ── Audio Operations ─────────────────────────────────────────────────────────
  getAudioOffsets: {
    paths: BASE_PATHS,
    step: makeStep(
      "getAudioOffsets",
      {},
      {
        sourcePath: "basePath",
        destinationFilesPath: "basePath",
      },
    ),
  },
  replaceFlacWithPcmAudio: {
    paths: BASE_PATHS,
    step: makeStep(
      "replaceFlacWithPcmAudio",
      { isRecursive: true },
      { sourcePath: "basePath" },
    ),
  },
  // ── Track Operations ─────────────────────────────────────────────────────────
  changeTrackLanguages: {
    paths: BASE_PATHS,
    step: makeStep(
      "changeTrackLanguages",
      {
        isRecursive: true,
        audioLanguage: "eng",
        subtitlesLanguage: "eng",
        videoLanguage: "jpn",
      },
      { sourcePath: "basePath" },
    ),
  },
  fixIncorrectDefaultTracks: {
    paths: BASE_PATHS,
    step: makeStep(
      "fixIncorrectDefaultTracks",
      { isRecursive: true },
      { sourcePath: "basePath" },
    ),
  },
  keepLanguages: {
    paths: BASE_PATHS,
    step: makeStep(
      "keepLanguages",
      {
        isRecursive: true,
        audioLanguages: ["eng", "jpn"],
        subtitlesLanguages: ["eng"],
        useFirstAudioLanguage: true,
        useFirstSubtitlesLanguage: true,
      },
      { sourcePath: "basePath" },
    ),
  },
  addSubtitles: {
    paths: BASE_PATHS,
    step: makeStep(
      "addSubtitles",
      {
        hasChapterSyncOffset: true,
        globalOffset: 100,
        includeChapters: true,
        offsets: [0, -200, 150],
      },
      {
        sourcePath: "basePath",
        subtitlesPath: "basePath",
      },
    ),
  },
  reorderTracks: {
    paths: BASE_PATHS,
    step: makeStep(
      "reorderTracks",
      {
        isRecursive: true,
        videoTrackIndexes: [0],
        audioTrackIndexes: [1, 0],
        subtitlesTrackIndexes: [0],
      },
      { sourcePath: "basePath" },
    ),
  },
  replaceTracks: {
    paths: BASE_PATHS,
    step: makeStep(
      "replaceTracks",
      {
        hasChapterSyncOffset: true,
        globalOffset: 100,
        includeChapters: true,
        audioLanguages: ["eng"],
        subtitlesLanguages: ["eng"],
        videoLanguages: ["eng"],
        offsets: [0, 100],
      },
      {
        sourcePath: "basePath",
        destinationFilesPath: "basePath",
      },
    ),
  },
  // ── Subtitle Operations ───────────────────────────────────────────────────────
  extractSubtitles: {
    paths: BASE_PATHS,
    step: makeStep(
      "extractSubtitles",
      { isRecursive: true, subtitlesLanguage: "eng" },
      { sourcePath: "basePath" },
    ),
  },
  copyOutSubtitles: {
    paths: BASE_PATHS,
    step: makeStep(
      "copyOutSubtitles",
      { isRecursive: true, subtitlesLanguage: "eng" },
      { sourcePath: "basePath" },
    ),
  },
  isMissingSubtitles: {
    paths: BASE_PATHS,
    step: makeStep(
      "isMissingSubtitles",
      { isRecursive: true },
      { sourcePath: "basePath" },
    ),
  },
  modifySubtitleMetadata: {
    paths: BASE_PATHS,
    step: makeStep(
      "modifySubtitleMetadata",
      {
        isRecursive: true,
        recursiveDepth: 2,
        predicates: [
          {
            field: "Name",
            op: "contains",
            value: "fixture-predicate",
          },
        ],
        hasDefaultRules: true,
        rules: [
          {
            match: {
              field: "Name",
              op: "eq",
              value: "Default",
            },
            actions: [{ field: "ScaleX", value: "1.0" }],
          },
        ],
      },
      { sourcePath: "basePath" },
    ),
  },
  // ── Analysis ─────────────────────────────────────────────────────────────────
  hasBetterAudio: {
    paths: BASE_PATHS,
    step: makeStep(
      "hasBetterAudio",
      { isRecursive: true, recursiveDepth: 2 },
      { sourcePath: "basePath" },
    ),
  },
  hasBetterVersion: {
    paths: BASE_PATHS,
    step: makeStep(
      "hasBetterVersion",
      { isRecursive: true, recursiveDepth: 2 },
      { sourcePath: "basePath" },
    ),
  },
  hasDuplicateMusicFiles: {
    paths: BASE_PATHS,
    step: makeStep(
      "hasDuplicateMusicFiles",
      { isRecursive: true, recursiveDepth: 2 },
      { sourcePath: "basePath" },
    ),
  },
  hasImaxEnhancedAudio: {
    paths: BASE_PATHS,
    step: makeStep(
      "hasImaxEnhancedAudio",
      { isRecursive: true },
      { sourcePath: "basePath" },
    ),
  },
  hasManyAudioTracks: {
    paths: BASE_PATHS,
    step: makeStep(
      "hasManyAudioTracks",
      { isRecursive: true },
      { sourcePath: "basePath" },
    ),
  },
  hasSurroundSound: {
    paths: BASE_PATHS,
    step: makeStep(
      "hasSurroundSound",
      { isRecursive: true, recursiveDepth: 2 },
      { sourcePath: "basePath" },
    ),
  },
  hasWrongDefaultTrack: {
    paths: BASE_PATHS,
    step: makeStep(
      "hasWrongDefaultTrack",
      { isRecursive: true },
      { sourcePath: "basePath" },
    ),
  },
  // ── Naming Operations ─────────────────────────────────────────────────────────
  nameAnimeEpisodes: {
    paths: BASE_PATHS,
    step: makeStep(
      "nameAnimeEpisodes",
      {
        malId: 39534,
        malName: "Violet Evergarden",
        seasonNumber: 2,
      },
      { sourcePath: "basePath" },
    ),
  },
  nameAnimeEpisodesAniDB: {
    paths: BASE_PATHS,
    step: makeStep(
      "nameAnimeEpisodesAniDB",
      {
        anidbId: 8160,
        anidbName: "Fullmetal Alchemist: Brotherhood",
        seasonNumber: 2,
        episodeType: "specials",
      },
      { sourcePath: "basePath" },
    ),
  },
  nameSpecialFeaturesDvdCompareTmdb: {
    paths: BASE_PATHS,
    step: makeStep(
      "nameSpecialFeaturesDvdCompareTmdb",
      {
        dvdCompareId: 74759,
        dvdCompareName:
          "The Lord of the Rings: The Fellowship of the Ring",
        dvdCompareReleaseHash: 12345,
        dvdCompareReleaseLabel: "Extended Edition",
        fixedOffset: 500,
        timecodePadding: 3,
        autoNameDuplicates: true,
        tmdbId: 120,
        tmdbName:
          "The Lord of the Rings: The Fellowship of the Ring",
      },
      { sourcePath: "basePath" },
    ),
  },
  nameTvShowEpisodes: {
    paths: BASE_PATHS,
    step: makeStep(
      "nameTvShowEpisodes",
      {
        tvdbId: 76703,
        tvdbName: "One Piece",
        seasonNumber: 1,
      },
      { sourcePath: "basePath" },
    ),
  },
  renameDemos: {
    paths: BASE_PATHS,
    step: makeStep(
      "renameDemos",
      { isRecursive: true },
      { sourcePath: "basePath" },
    ),
  },
  renameMovieClipDownloads: {
    paths: BASE_PATHS,
    step: makeStep(
      "renameMovieClipDownloads",
      {},
      { sourcePath: "basePath" },
    ),
  },
  // ── Video Operations ──────────────────────────────────────────────────────────
  setDisplayWidth: {
    paths: BASE_PATHS,
    step: makeStep(
      "setDisplayWidth",
      {
        displayWidth: 1280,
        isRecursive: true,
        recursiveDepth: 2,
      },
      { sourcePath: "basePath" },
    ),
  },
  // ── Metadata Operations ───────────────────────────────────────────────────────
  storeAspectRatioData: {
    paths: BASE_PATHS,
    step: makeStep(
      "storeAspectRatioData",
      {
        isRecursive: true,
        recursiveDepth: 2,
        rootPath: "fixture-string-rootPath",
        folders: ["folder-a", "folder-b"],
        force: true,
      },
      { sourcePath: "basePath", outputPath: "basePath" },
    ),
  },
}

// ─── Generate fixture files ───────────────────────────────────────────────────

let fixtureCount = 0
const missingCommands: string[] = []

Object.entries(FIXTURE_INPUTS).forEach(
  ([commandName, fixtureInput]) => {
    const commandDefinition = COMMANDS[commandName]
    if (!commandDefinition) {
      missingCommands.push(commandName)
      return
    }

    const resolvedParams = buildParams(
      fixtureInput.step,
      commandDefinition,
    )
    const yamlStr = buildYaml(
      fixtureInput.step,
      resolvedParams,
      fixtureInput.paths,
    )

    writeFileSync(
      join(outputDir, `${commandName}.yaml`),
      yamlStr,
      "utf8",
    )
    writeFileSync(
      join(outputDir, `${commandName}.input.json`),
      `${JSON.stringify(
        {
          paths: fixtureInput.paths,
          step: {
            id: fixtureInput.step.id,
            command: fixtureInput.step.command,
            params: fixtureInput.step.params,
            links: fixtureInput.step.links,
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    )

    fixtureCount++
  },
)

// Warn about any commands in COMMANDS that have no fixture input defined
const undefinedCommands = Object.keys(COMMANDS).filter(
  (commandName) => !(commandName in FIXTURE_INPUTS),
)

console.log(
  `Generated ${fixtureCount} fixture pairs in ${outputDir}`,
)

if (missingCommands.length > 0) {
  console.error(
    `ERROR: Fixture inputs defined for unknown commands: ${missingCommands.join(", ")}`,
  )
  process.exit(1)
}

if (undefinedCommands.length > 0) {
  console.warn(
    `WARNING: No fixture input defined for commands: ${undefinedCommands.join(", ")}`,
  )
  console.warn(
    "Add entries to FIXTURE_INPUTS to capture these commands.",
  )
}
