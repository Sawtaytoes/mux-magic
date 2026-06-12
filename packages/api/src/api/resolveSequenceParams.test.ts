import { describe, expect, test } from "vitest"
import { z } from "zod"

import {
  resolveSequenceParams,
  type SequencePath,
  type StepRuntimeRecord,
} from "./resolveSequenceParams.js"
import type { CommandConfig } from "./routes/commandRoutes.js"

// Minimal CommandConfig stub: only outputFolderName matters for the folder
// output computation, the other fields are placeholders the resolver never
// reads.
const makeConfig = (
  overrides: Partial<CommandConfig> = {},
): CommandConfig => ({
  getObservable: () => {
    throw new Error("not used in resolver tests")
  },
  schema: z.unknown(),
  summary: "stub",
  tags: [],
  ...overrides,
})

const PATHS: Record<string, SequencePath> = {
  workDir: { label: "Work", value: "D:\\Anime\\Show" },
  scratch: { label: "Scratch", value: "D:\\Scratch" },
}

describe(resolveSequenceParams.name, () => {
  test("passes literal values through unchanged", () => {
    const { resolved, errors } = resolveSequenceParams({
      rawParams: {
        audioLanguages: ["jpn"],
        isRecursive: false,
        count: 4,
      },
      pathsById: PATHS,
      stepsById: {},
      commandConfigsByName: {},
    })
    expect(resolved).toEqual({
      audioLanguages: ["jpn"],
      isRecursive: false,
      count: 4,
    })
    expect(errors).toEqual([])
  })

  test("coerces a numeric-typed variable's string .value to Number on @id resolution", () => {
    // dvdCompareId variables serialize as `value: '68856'` (variables
    // always store strings) but the nameSpecialFeaturesDvdCompareTmdb
    // schema declares `dvdCompareId: z.number()`. The resolver must
    // coerce so the request body satisfies the schema.
    const { resolved, errors } = resolveSequenceParams({
      rawParams: { dvdCompareId: "@dvd1" },
      pathsById: {
        dvd1: { value: "68856", type: "dvdCompareId" },
      },
      stepsById: {},
      commandConfigsByName: {},
    })
    expect(resolved).toEqual({ dvdCompareId: 68856 })
    expect(errors).toEqual([])
  })

  test("falls back to the raw string when a numeric-typed variable's value isn't numeric", () => {
    // Worker 35's validator allows DVD Compare slugs ("spider-man-2002")
    // alongside numeric IDs. The downstream schema is z.number(), so
    // such a value will fail validation anyway — but passing through the
    // raw string makes zod's error name the actual offender instead of
    // reporting NaN.
    const { resolved } = resolveSequenceParams({
      rawParams: { dvdCompareId: "@dvd1" },
      pathsById: {
        dvd1: {
          value: "spider-man-2002",
          type: "dvdCompareId",
        },
      },
      stepsById: {},
      commandConfigsByName: {},
    })
    expect(resolved).toEqual({
      dvdCompareId: "spider-man-2002",
    })
  })

  test("resolves @pathId references against the paths table", () => {
    const { resolved, errors } = resolveSequenceParams({
      rawParams: {
        sourcePath: "@workDir",
        destinationPath: "@scratch",
      },
      pathsById: PATHS,
      stepsById: {},
      commandConfigsByName: {},
    })
    expect(resolved).toEqual({
      sourcePath: "D:\\Anime\\Show",
      destinationPath: "D:\\Scratch",
    })
    expect(errors).toEqual([])
  })

  test("collects an error when an @pathId reference does not exist", () => {
    const { resolved, errors } = resolveSequenceParams({
      rawParams: { sourcePath: "@unknown" },
      pathsById: PATHS,
      stepsById: {},
      commandConfigsByName: {},
    })
    expect(resolved).toEqual({})
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/unknown/i)
  })

  test("resolves { linkedTo, output: 'folder' } using the source step's outputFolderName + sourcePath", () => {
    const stepsById: Record<string, StepRuntimeRecord> = {
      step1: {
        command: "keepLanguages",
        resolvedParams: { sourcePath: "D:\\Anime\\Show" },
        outputs: null,
      },
    }
    const commandConfigsByName = {
      keepLanguages: makeConfig({
        outputFolderName: "KEEP-LANG",
      }),
    }
    const { resolved, errors } = resolveSequenceParams({
      rawParams: {
        sourcePath: { linkedTo: "step1", output: "folder" },
      },
      pathsById: {},
      stepsById,
      commandConfigsByName,
    })
    expect(resolved.sourcePath).toBe(
      "D:\\Anime\\Show/KEEP-LANG",
    )
    expect(errors).toEqual([])
  })

  test("falls back to destinationPath when the source step has no outputFolderName", () => {
    const stepsById: Record<string, StepRuntimeRecord> = {
      stepCopy: {
        command: "copyFiles",
        resolvedParams: {
          sourcePath: "D:\\Work\\TMP",
          destinationPath: "D:\\Work",
        },
        outputs: null,
      },
    }
    const commandConfigsByName = {
      copyFiles: makeConfig({}),
    }
    const { resolved } = resolveSequenceParams({
      rawParams: {
        sourcePath: {
          linkedTo: "stepCopy",
          output: "folder",
        },
      },
      pathsById: {},
      stepsById,
      commandConfigsByName,
    })
    expect(resolved.sourcePath).toBe("D:\\Work")
  })

  test("treats a missing `output` key as 'folder' (default)", () => {
    const stepsById: Record<string, StepRuntimeRecord> = {
      step1: {
        command: "keepLanguages",
        resolvedParams: { sourcePath: "D:\\X" },
        outputs: null,
      },
    }
    const commandConfigsByName = {
      keepLanguages: makeConfig({
        outputFolderName: "OUT",
      }),
    }
    const { resolved } = resolveSequenceParams({
      rawParams: { sourcePath: { linkedTo: "step1" } },
      pathsById: {},
      stepsById,
      commandConfigsByName,
    })
    expect(resolved.sourcePath).toBe("D:\\X/OUT")
  })

  test("resolves named runtime outputs when the source step produced them", () => {
    const stepsById: Record<string, StepRuntimeRecord> = {
      compRules: {
        command: "modifySubtitleMetadata",
        resolvedParams: { sourcePath: "D:\\Work" },
        outputs: {
          rules: [
            {
              type: "setScriptInfo",
              key: "ScriptType",
              value: "v4.00+",
            },
          ],
        },
      },
    }
    const { resolved, errors } = resolveSequenceParams({
      rawParams: {
        rules: { linkedTo: "compRules", output: "rules" },
      },
      pathsById: {},
      stepsById,
      commandConfigsByName: {
        modifySubtitleMetadata: makeConfig(),
      },
    })
    expect(resolved.rules).toEqual([
      {
        type: "setScriptInfo",
        key: "ScriptType",
        value: "v4.00+",
      },
    ])
    expect(errors).toEqual([])
  })

  test("collects an error when a named output reference points at an unproduced output", () => {
    const stepsById: Record<string, StepRuntimeRecord> = {
      compRules: {
        command: "modifySubtitleMetadata",
        resolvedParams: { sourcePath: "D:\\Work" },
        outputs: { rules: [] },
      },
    }
    const { resolved, errors } = resolveSequenceParams({
      rawParams: {
        rules: { linkedTo: "compRules", output: "missing" },
      },
      pathsById: {},
      stepsById,
      commandConfigsByName: {
        modifySubtitleMetadata: makeConfig(),
      },
    })
    expect(resolved).toEqual({})
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/missing/i)
  })

  test("collects an error when a step reference targets a step that hasn't run yet", () => {
    const { resolved, errors } = resolveSequenceParams({
      rawParams: {
        sourcePath: {
          linkedTo: "step99",
          output: "folder",
        },
      },
      pathsById: {},
      stepsById: {},
      commandConfigsByName: {},
    })
    expect(resolved).toEqual({})
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/step99/)
  })

  test("computes 'parentOfSource' folder output as the parent directory of the source path", () => {
    const stepsById: Record<string, StepRuntimeRecord> = {
      flat: {
        command: "flattenOutput",
        resolvedParams: {
          sourcePath: "D:\\Work\\SUBTITLED",
        },
        outputs: null,
      },
    }
    const { resolved } = resolveSequenceParams({
      rawParams: {
        sourcePath: { linkedTo: "flat", output: "folder" },
      },
      pathsById: {},
      stepsById,
      commandConfigsByName: {
        flattenOutput: makeConfig({
          outputComputation: "parentOfSource",
        }),
      },
    })
    expect(resolved.sourcePath).toBe("D:\\Work")
  })

  test("strips a trailing separator before computing 'parentOfSource'", () => {
    const stepsById: Record<string, StepRuntimeRecord> = {
      flat: {
        command: "flattenOutput",
        resolvedParams: {
          sourcePath: "D:\\Work\\SUBTITLED\\",
        },
        outputs: null,
      },
    }
    const { resolved } = resolveSequenceParams({
      rawParams: {
        sourcePath: { linkedTo: "flat", output: "folder" },
      },
      pathsById: {},
      stepsById,
      commandConfigsByName: {
        flattenOutput: makeConfig({
          outputComputation: "parentOfSource",
        }),
      },
    })
    expect(resolved.sourcePath).toBe("D:\\Work")
  })

  test("strips a trailing separator from the source path before joining outputFolderName", () => {
    const stepsById: Record<string, StepRuntimeRecord> = {
      step1: {
        command: "keepLanguages",
        resolvedParams: { sourcePath: "D:\\Show\\" },
        outputs: null,
      },
    }
    const { resolved } = resolveSequenceParams({
      rawParams: {
        sourcePath: { linkedTo: "step1", output: "folder" },
      },
      pathsById: {},
      stepsById,
      commandConfigsByName: {
        keepLanguages: makeConfig({
          outputFolderName: "OUT",
        }),
      },
    })
    expect(resolved.sourcePath).toBe("D:\\Show/OUT")
  })

  // ─── Worker 45: tmdbId / anidbId / malId numeric coercion ──────────────────

  test("coerces a tmdbId variable's string .value to Number on @id resolution", () => {
    const { resolved, errors } = resolveSequenceParams({
      rawParams: { tmdbId: "@tmdb1" },
      pathsById: {
        tmdb1: { value: "157336", type: "tmdbId" },
      },
      stepsById: {},
      commandConfigsByName: {},
    })
    expect(resolved).toEqual({ tmdbId: 157336 })
    expect(errors).toEqual([])
  })

  test("coerces an anidbId variable's string .value to Number on @id resolution", () => {
    const { resolved, errors } = resolveSequenceParams({
      rawParams: { anidbId: "@anidb1" },
      pathsById: {
        anidb1: { value: "8160", type: "anidbId" },
      },
      stepsById: {},
      commandConfigsByName: {},
    })
    expect(resolved).toEqual({ anidbId: 8160 })
    expect(errors).toEqual([])
  })

  test("coerces a malId variable's string .value to Number on @id resolution", () => {
    const { resolved, errors } = resolveSequenceParams({
      rawParams: { malId: "@mal1" },
      pathsById: {
        mal1: { value: "5114", type: "malId" },
      },
      stepsById: {},
      commandConfigsByName: {},
    })
    expect(resolved).toEqual({ malId: 5114 })
    expect(errors).toEqual([])
  })
})
