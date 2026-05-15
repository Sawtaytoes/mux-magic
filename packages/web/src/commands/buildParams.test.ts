import { describe, expect, test } from "vitest"
import type { CommandDefinition } from "../commands/types"
import type { Step } from "../types"
import { buildParams } from "./buildParams"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeStep = (
  command: string,
  params: Record<string, unknown>,
  links: Step["links"] = {},
): Step => ({
  id: "test-step",
  alias: "",
  command,
  params,
  links,
  status: null,
  error: null,
  isCollapsed: false,
})

// ─── Branch: simple field (no link, value passes through) ────────────────────
// Representative command: makeDirectory — one required path field, linked.
// Uses the exact parity fixture input from makeDirectory.input.json.

describe("buildParams — string link branch (@id prefix)", () => {
  test("required path field linked to a path var becomes @<id>", () => {
    const commandDefinition: CommandDefinition = {
      fields: [
        {
          name: "sourcePath",
          type: "path",
          label: "Source Path",
          isRequired: true,
        },
      ],
    }
    const step = makeStep(
      "makeDirectory",
      {},
      { sourcePath: "basePath" },
    )

    expect(buildParams(step, commandDefinition)).toEqual({
      sourcePath: "@basePath",
    })
  })
})

// ─── Branch: simple passthrough (value in params, no link) ───────────────────
// Representative: flattenOutput with deleteSourceFolder=true (non-default).

describe("buildParams — simple passthrough branch", () => {
  test("non-default boolean included; required linked path becomes @id", () => {
    const commandDefinition: CommandDefinition = {
      fields: [
        {
          name: "sourcePath",
          type: "path",
          label: "Output Folder to Flatten",
          isRequired: true,
        },
        {
          name: "deleteSourceFolder",
          type: "boolean",
          label:
            "Also delete the source folder after copying",
          default: false,
        },
      ],
    }
    const step = makeStep(
      "flattenOutput",
      { deleteSourceFolder: true },
      { sourcePath: "basePath" },
    )

    expect(buildParams(step, commandDefinition)).toEqual({
      sourcePath: "@basePath",
      deleteSourceFolder: true,
    })
  })

  test("field equal to its default is omitted when not required", () => {
    const commandDefinition: CommandDefinition = {
      fields: [
        {
          name: "isRecursive",
          type: "boolean",
          label: "Recursive",
          default: false,
        },
      ],
    }
    const step = makeStep("replaceFlacWithPcmAudio", {
      isRecursive: false,
    })

    expect(buildParams(step, commandDefinition)).toEqual({})
  })

  test("field equal to its default is included when required", () => {
    const commandDefinition: CommandDefinition = {
      fields: [
        {
          name: "seasonNumber",
          type: "number",
          label: "Season Number",
          isRequired: true,
          default: 1,
        },
      ],
    }
    const step = makeStep("nameTvShowEpisodes", {
      seasonNumber: 1,
    })

    expect(buildParams(step, commandDefinition)).toEqual({
      seasonNumber: 1,
    })
  })

  test("undefined / null / empty-string values are omitted", () => {
    const commandDefinition: CommandDefinition = {
      fields: [
        { name: "alpha", type: "string" },
        { name: "beta", type: "string" },
        { name: "gamma", type: "string" },
      ],
    }
    const step = makeStep("someCommand", {
      alpha: undefined,
      beta: null,
      gamma: "",
    })

    expect(buildParams(step, commandDefinition)).toEqual({})
  })

  test("empty array value is omitted", () => {
    const commandDefinition: CommandDefinition = {
      fields: [
        {
          name: "extensions",
          type: "stringArray",
          isRequired: true,
        },
      ],
    }
    const step = makeStep("deleteFilesByExtension", {
      extensions: [],
    })

    expect(buildParams(step, commandDefinition)).toEqual({})
  })
})

// ─── Branch: object link ({ linkedTo, output }) ───────────────────────────────
// Constructed directly — no parity fixture exercises this path since fixtures
// use path-var string links. Matches the capture script's object-link branch.

describe("buildParams — object link branch", () => {
  test("object link with explicit output is preserved as-is", () => {
    const commandDefinition: CommandDefinition = {
      fields: [
        {
          name: "sourcePath",
          type: "path",
          label: "Source Path",
          isRequired: true,
        },
      ],
    }
    const step = makeStep(
      "copyFiles",
      {},
      {
        sourcePath: {
          linkedTo: "prev-step-id",
          output: "folder",
        },
      },
    )

    expect(buildParams(step, commandDefinition)).toEqual({
      sourcePath: {
        linkedTo: "prev-step-id",
        output: "folder",
      },
    })
  })

  test("object link with missing output defaults to 'folder'", () => {
    const commandDefinition: CommandDefinition = {
      fields: [
        {
          name: "sourcePath",
          type: "path",
          label: "Source Path",
          isRequired: true,
        },
      ],
    }
    const step = makeStep(
      "copyFiles",
      {},
      // Cast to satisfy the StepLink union — the runtime case being tested is
      // an object link where `output` was omitted (e.g., from a stale YAML).
      {
        sourcePath: {
          linkedTo: "prev-step-id",
          output: "",
        },
      },
    )

    expect(buildParams(step, commandDefinition)).toEqual({
      sourcePath: {
        linkedTo: "prev-step-id",
        output: "folder",
      },
    })
  })
})

// ─── Branch: companionNameField ───────────────────────────────────────────────
// Representative: nameAnimeEpisodes — malId has companionNameField:"malName".
// Uses parity fixture input values.

describe("buildParams — companionNameField branch", () => {
  test("companion value is emitted alongside primary", () => {
    const commandDefinition: CommandDefinition = {
      fields: [
        {
          name: "sourcePath",
          type: "path",
          label: "Source Path",
          isRequired: true,
        },
        {
          name: "malId",
          type: "numberWithLookup",
          lookupType: "mal",
          label: "MAL ID",
          isRequired: true,
          companionNameField: "malName",
        },
        {
          name: "seasonNumber",
          type: "number",
          label: "Season Number",
          default: 1,
        },
      ],
    }
    const step = makeStep(
      "nameAnimeEpisodes",
      {
        malId: 39534,
        malName: "Violet Evergarden",
        seasonNumber: 2,
      },
      { sourcePath: "basePath" },
    )

    expect(buildParams(step, commandDefinition)).toEqual({
      sourcePath: "@basePath",
      malId: 39534,
      malName: "Violet Evergarden",
      seasonNumber: 2,
    })
  })

  test("companion is omitted when its value is empty string", () => {
    const commandDefinition: CommandDefinition = {
      fields: [
        {
          name: "malId",
          type: "numberWithLookup",
          isRequired: true,
          companionNameField: "malName",
        },
      ],
    }
    const step = makeStep("nameAnimeEpisodes", {
      malId: 39534,
      malName: "",
    })

    expect(buildParams(step, commandDefinition)).toEqual({
      malId: 39534,
    })
  })
})

// ─── Branch: persistedKeys ────────────────────────────────────────────────────
// Representative: nameSpecialFeaturesDvdCompareTmdb with tmdbId/tmdbName persisted.
// Uses parity fixture input values.

describe("buildParams — persistedKeys branch", () => {
  test("persisted keys appear in result regardless of field list", () => {
    const commandDefinition: CommandDefinition = {
      persistedKeys: ["tmdbId", "tmdbName"],
      fields: [
        {
          name: "sourcePath",
          type: "path",
          isRequired: true,
        },
        {
          name: "dvdCompareId",
          type: "numberWithLookup",
          isRequired: true,
          companionNameField: "dvdCompareName",
        },
        {
          name: "dvdCompareReleaseHash",
          type: "number",
          default: 1,
          companionNameField: "dvdCompareReleaseLabel",
        },
        { name: "fixedOffset", type: "number", default: 0 },
        {
          name: "timecodePadding",
          type: "number",
          default: 2,
        },
        {
          name: "autoNameDuplicates",
          type: "boolean",
          default: false,
        },
      ],
    }
    const step = makeStep(
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
    )

    expect(buildParams(step, commandDefinition)).toEqual({
      sourcePath: "@basePath",
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
    })
  })

  test("persisted key with empty value is omitted", () => {
    const commandDefinition: CommandDefinition = {
      persistedKeys: ["tmdbId", "tmdbName"],
      fields: [],
    }
    const step = makeStep(
      "nameSpecialFeaturesDvdCompareTmdb",
      {
        tmdbId: "",
        tmdbName: null,
      },
    )

    expect(buildParams(step, commandDefinition)).toEqual({})
  })
})
