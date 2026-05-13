import {
  createRoute,
  OpenAPIHono,
  z,
} from "@hono/zod-openapi"
import yaml from "js-yaml"

import {
  getFakeScenario,
  isFakeRequest,
} from "../../fake-data/index.js"
import { createJob } from "../jobStore.js"
import {
  runSequenceJob,
  type SequenceBody,
} from "../sequenceRunner.js"
import { commandNames } from "./commandRoutes.js"

// ─── Param value forms ──────────────────────────────────────────────────────
//
// Each step's `params` value can take one of three shapes. They're declared
// here as referenceable schemas so the OpenAPI docs surface them in the
// schema panel rather than just "unknown".

const pathReferenceSchema = z
  .string()
  .regex(
    /^@[A-Za-z0-9_-]+$/u,
    "Path-variable references look like '@<pathId>' (the @ followed by a key from the top-level `paths` map).",
  )
  .openapi("PathReference", {
    description:
      "Reference to a path variable defined in the top-level `paths` map. The string is `@` followed by the path id (e.g. `'@workDir'`). Resolved at runtime to the path's `value`.",
    example: "@workDir",
  })

const stepOutputReferenceSchema = z
  .object({
    linkedTo: z
      .string()
      .describe(
        "Stable id of the source step (matches that step's `id` field — auto-assigned `step1`, `step2`, … when omitted).",
      ),
    output: z
      .string()
      .optional()
      .describe(
        "Which named output to consume. `'folder'` (the default) resolves to the source step's synthesized output folder — `<sourcePath>/<outputFolderName>` for most commands, `dirname(sourcePath)` for `flattenOutput`. Other values name runtime outputs the source command publishes via its `extractOutputs` projector (e.g. `'rules'` for `computeDefaultSubtitleRules`).",
      ),
  })
  .openapi("StepOutputReference", {
    description:
      "Reference to a previous step's output. Resolved at runtime against that step's runtime `outputs` map (or the synthesized folder path when `output` is omitted or `'folder'`).",
    example: { linkedTo: "filterLangs", output: "folder" },
  })

// ─── Sequence document shape ────────────────────────────────────────────────

const sequenceStepSchema = z
  .object({
    // Required literal at the schema level so the OpenAPI generator's
    // discriminated-union transformer can read the discriminator value.
    // The `sequenceItemSchema` preprocess below injects `kind: "step"`
    // when callers omit it, so existing flat-step YAMLs still validate
    // even though the documented schema marks `kind` as required.
    kind: z
      .literal("step")
      .describe(
        'Discriminator marking this entry as a single step. May be omitted on input — the server treats a missing `kind` as `"step"` for backward compatibility with the original flat-step YAML form. The other allowed value is `"group"` (see `SequenceGroup`).',
      ),
    id: z
      .string()
      .optional()
      .describe(
        "Stable identifier for this step. Optional on input — auto-assigned (`step1`, `step2`, ...) when omitted. Used as the target of `{ linkedTo, output }` references from later steps.",
      ),
    alias: z
      .string()
      .optional()
      .describe(
        "Optional human-readable alias. Surfaced by the builder UI's step header; ignored at runtime.",
      ),
    command: z
      .enum(commandNames)
      .describe(
        "Name of the registered command to run. Must be one of the names listed at `GET /commands` (or surfaced individually as `POST /commands/<name>` endpoints).",
      ),
    params: z
      .record(z.string(), z.unknown())
      .optional()
      .describe(
        "Command params. Each value can be a literal (string / number / boolean / array / object), a `'@pathId'` path-variable reference, or a `{ linkedTo, output }` step-output reference. Per-command param shapes are documented under `POST /commands/<command>` — the same schema each command exposes for direct invocation also applies here once references are resolved.",
      ),
    isCollapsed: z
      .boolean()
      .optional()
      .describe(
        "Builder-UI accordion state. When `true`, the card renders with its body hidden. Pure view state; ignored at runtime.",
      ),
  })
  .openapi("SequenceStep", {
    description: "A single step inside a sequence.",
    example: {
      id: "filterLangs",
      command: "keepLanguages",
      params: {
        sourcePath: "@workDir",
        audioLanguages: ["jpn"],
        subtitlesLanguages: ["eng"],
      },
    },
  })

// Inner steps inside a group go through the same kind-injection
// preprocess that top-level steps do, so callers can omit `kind: "step"`
// inside groups too. Wrapping `sequenceStepSchema` (which requires the
// literal) keeps the OpenAPI doc honest while accepting the bare form.
const preprocessedStepSchema = z.preprocess((value) => {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as { kind?: unknown }).kind === undefined
  ) {
    return {
      ...(value as Record<string, unknown>),
      kind: "step",
    }
  }
  return value
}, sequenceStepSchema)

const sequenceGroupSchema = z
  .object({
    kind: z
      .literal("group")
      .describe(
        "Discriminator marking this entry as a group of steps rather than a single step.",
      ),
    id: z
      .string()
      .optional()
      .describe(
        "Optional stable identifier for the group. Currently used only by the builder UI; not referenceable from `linkedTo` (`linkedTo` always targets steps, not groups).",
      ),
    label: z
      .string()
      .optional()
      .describe(
        "Optional human-readable label rendered in the group's header by the builder UI. Ignored at runtime.",
      ),
    isParallel: z
      .boolean()
      .optional()
      .describe(
        "When `true`, the group's inner steps run concurrently (Promise.all). When omitted or `false`, they run sequentially in array order. The builder UI also lays parallel groups out side-by-side on wide viewports.",
      ),
    isCollapsed: z
      .boolean()
      .optional()
      .describe(
        "Builder-UI accordion state for the group as a whole. When `true`, the group's inner step cards are hidden. Pure view state; ignored at runtime.",
      ),
    steps: z
      .array(preprocessedStepSchema)
      .min(1)
      .describe(
        "Inner steps. Groups don't nest — each entry must be a step, not another group.",
      ),
  })
  .openapi("SequenceGroup", {
    description:
      "A container for a set of steps. Marked `isParallel: true` to run concurrently; otherwise the inner steps run sequentially. Groups are flat — they can contain steps but not other groups.",
    example: {
      kind: "group",
      id: "extractParallel",
      label: "Extract subs + media info",
      isParallel: true,
      steps: [
        {
          id: "subs",
          command: "copyOutSubtitles",
          params: { sourcePath: "@workDir" },
        },
        {
          id: "info",
          command: "getSubtitleMetadata",
          params: { sourcePath: "@workDir" },
        },
      ],
    },
  })

// Discriminated union over `kind`. The preprocess step injects
// `kind: "step"` when missing, so existing YAMLs that wrote bare-step
// entries (no `kind` field) keep validating unchanged.
const sequenceItemSchema = z.preprocess(
  (value) => {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (value as { kind?: unknown }).kind === undefined
    ) {
      return {
        ...(value as Record<string, unknown>),
        kind: "step",
      }
    }
    return value
  },
  z.discriminatedUnion("kind", [
    sequenceStepSchema,
    sequenceGroupSchema,
  ]),
)

// Walks the parsed top-level item array to enforce two cross-item
// invariants that the per-item schemas can't see on their own:
//   1. Step ids must be globally unique across the top level + every
//      group's children. Two steps sharing an id would let `linkedTo`
//      ambiguously target either.
//   2. Inside a parallel group, no step can `linkedTo` a sibling — they
//      all start at the same time, so a sibling's outputs aren't
//      available. (Steps before the group, and steps after it
//      referencing inner steps, both stay legal.)
const validateSequenceItems = (
  items: ReadonlyArray<z.infer<typeof sequenceItemSchema>>,
  ctx: z.RefinementCtx,
): void => {
  const seenIds = new Set<string>()
  const flagDuplicate = (
    id: string,
    path: (string | number)[],
  ): void => {
    if (seenIds.has(id)) {
      ctx.addIssue({
        code: "custom",
        message: `Duplicate step id "${id}". Step ids must be unique across the whole sequence (including across groups).`,
        path,
      })
    }
    seenIds.add(id)
  }

  items.forEach((item, itemIndex) => {
    if (item.kind === "group") {
      item.steps.forEach((step, stepIndex) => {
        if (
          typeof step.id === "string" &&
          step.id.length > 0
        ) {
          flagDuplicate(step.id, [
            itemIndex,
            "steps",
            stepIndex,
            "id",
          ])
        }
      })
      if (item.isParallel === true) {
        const siblingIds = new Set(
          item.steps
            .map((step) => step.id)
            .filter(
              (id): id is string =>
                typeof id === "string" && id.length > 0,
            ),
        )
        item.steps.forEach((step, stepIndex) => {
          Object.entries(step.params ?? {}).forEach(
            ([paramName, value]) => {
              if (
                value &&
                typeof value === "object" &&
                !Array.isArray(value) &&
                typeof (value as { linkedTo?: unknown })
                  .linkedTo === "string" &&
                siblingIds.has(
                  (value as { linkedTo: string }).linkedTo,
                )
              ) {
                ctx.addIssue({
                  code: "custom",
                  message: `Step "${step.id ?? `(group child #${stepIndex + 1})`}" param "${paramName}" links to "${(value as { linkedTo: string }).linkedTo}", a sibling inside the same parallel group. Parallel-group siblings start at the same time, so their outputs aren't available to each other.`,
                  path: [
                    itemIndex,
                    "steps",
                    stepIndex,
                    "params",
                    paramName,
                  ],
                })
              }
            },
          )
        })
      }
    } else {
      if (
        typeof item.id === "string" &&
        item.id.length > 0
      ) {
        flagDuplicate(item.id, [itemIndex, "id"])
      }
    }
  })
}

const sequencePathSchema = z
  .object({
    label: z
      .string()
      .optional()
      .describe(
        "Display label for the path variable (used by the builder UI; ignored at runtime).",
      ),
    value: z
      .string()
      .describe(
        "The actual path string this variable resolves to.",
      ),
  })
  .openapi("SequencePath", {
    description:
      "A path-variable definition. Path variables are referenced from step params via the `'@pathId'` string form.",
    example: {
      label: "Work Directory",
      value: "D:\\Anime\\Show\\__work",
    },
  })

// Generic variable entry in the new `variables:` block (introduced by the
// Variables system in worker 36). Each entry carries a `type` discriminator
// so the server can extract typed variables (e.g. `threadCount`) without
// treating them as path variables.
const sequenceVariableSchema = z
  .object({
    label: z
      .string()
      .optional()
      .describe(
        "Display label (used by the builder UI; ignored at runtime).",
      ),
    value: z
      .string()
      .describe("The variable's current value as a string."),
    type: z
      .string()
      .describe(
        "Variable type discriminator (e.g. `'path'`, `'threadCount'`). The server uses this to apply type-specific semantics at runtime.",
      ),
  })
  .openapi("SequenceVariable", {
    description:
      "A typed variable definition. Path variables (type='path') are referenced from step params via `'@<id>'`. Other types (e.g. 'threadCount') carry runtime configuration consumed by the server.",
    example: {
      label: "Max threads",
      value: "4",
      type: "threadCount",
    },
  })

const parsedSequenceSchema = z
  .object({
    paths: z
      .record(z.string(), sequencePathSchema)
      .optional()
      .describe(
        "Top-level path-variable map keyed by path id. Each entry is referenced from step params via `'@<pathId>'`. Superseded by the `variables` block — both are accepted for backward compatibility.",
      ),
    variables: z
      .record(z.string(), sequenceVariableSchema)
      .optional()
      .describe(
        "Typed variable map (introduced by the Variables system). Entries with `type: 'path'` are resolved the same as legacy `paths` entries; entries with `type: 'threadCount'` set the per-job thread cap.",
      ),
    steps: z
      .array(sequenceItemSchema)
      .describe(
        'Sequence of items to run in order. Each item is either a single step (the existing flat form) or a `kind: "group"` container (new). Stops on the first failure; remaining items don\'t run.',
      ),
  })
  .openapi("ParsedSequenceBody", {
    description:
      "Pre-parsed sequence body. Use this shape if you have the sequence as JSON; otherwise post a YAML string under `yaml` (the server parses with js-yaml and validates against this same schema).",
    example: {
      paths: {
        workDir: {
          label: "Work Directory",
          value: "D:\\Anime\\Show\\__work",
        },
        parentDir: {
          label: "Parent Series Folder",
          value: "D:\\Anime\\Show",
        },
      },
      steps: [
        {
          id: "filterLangs",
          command: "keepLanguages",
          params: {
            sourcePath: "@workDir",
            audioLanguages: ["jpn"],
            subtitlesLanguages: ["eng"],
          },
        },
        {
          id: "copyBack",
          command: "copyFiles",
          params: {
            sourcePath: {
              linkedTo: "filterLangs",
              output: "folder",
            },
            destinationPath: "@workDir",
          },
        },
        {
          id: "computeRules",
          command: "computeDefaultSubtitleRules",
          params: { sourcePath: "@workDir" },
        },
        {
          id: "applyRules",
          command: "modifySubtitleMetadata",
          params: {
            sourcePath: "@workDir",
            rules: {
              linkedTo: "computeRules",
              output: "rules",
            },
          },
        },
      ],
    },
  })

const yamlSequenceSchema = z
  .object({
    yaml: z
      .string()
      .describe(
        "YAML source. The server parses with js-yaml and validates against the same schema as the parsed-JSON body — see the `ParsedSequenceBody` schema for the document shape. Parse failures and shape-mismatch validation errors return 400 with a descriptive message.",
      ),
  })
  .openapi("YamlSequenceBody", {
    description:
      "YAML-string sequence body. The yaml field carries the raw text the builder UI's `View YAML` modal shows.",
    example: {
      yaml: [
        "paths:",
        "  workDir:",
        "    label: Work Directory",
        "    value: 'D:\\Anime\\Show\\__work'",
        "steps:",
        "  - id: filterLangs",
        "    command: keepLanguages",
        "    params:",
        "      sourcePath: '@workDir'",
        "      audioLanguages: [jpn]",
        "      subtitlesLanguages: [eng]",
        "  - id: copyBack",
        "    command: copyFiles",
        "    params:",
        "      sourcePath:",
        "        linkedTo: filterLangs",
        "        output: folder",
        "      destinationPath: '@workDir'",
      ].join("\n"),
    },
  })

// `parsedSequenceSchema` provides the OpenAPI-named schema reference;
// the cross-item validator (unique ids, no parallel-sibling links) lives
// in this wrapper so the route handler applies it both to YAML-parsed
// bodies and to JSON bodies. The wrapper is intentionally not given an
// `.openapi(...)` name so the docs continue to reference the bare
// `ParsedSequenceBody` schema rather than a wrapped variant.
const validatedParsedSequenceSchema =
  parsedSequenceSchema.superRefine((parsed, ctx) => {
    validateSequenceItems(parsed.steps, ctx)
  })

const sequenceRequestSchema = z.union([
  yamlSequenceSchema,
  validatedParsedSequenceSchema,
])

const sequenceResponseSchema = z
  .object({
    jobId: z
      .string()
      .describe(
        "Umbrella job id. Subscribe to `GET /jobs/<jobId>/logs` (SSE) for the unified log stream of every step, or poll `GET /jobs/<jobId>` for status.",
      ),
    logsUrl: z
      .string()
      .describe(
        "Convenience URL for the SSE log stream — same as `/jobs/<jobId>/logs`.",
      ),
  })
  .openapi("SequenceJobAccepted", {
    example: {
      jobId: "9d2f8c3e-4a1b-4c2d-9e7f-8a3b2c1d5e7f",
      logsUrl:
        "/jobs/9d2f8c3e-4a1b-4c2d-9e7f-8a3b2c1d5e7f/logs",
    },
  })

// Reference the link-form schemas so OpenAPI surfaces them under
// "Schemas" in the generated docs — without an explicit reference,
// orphan zod-openapi types don't end up in components/schemas.
const _linkFormSchemaRefs = z
  .object({
    pathReference: pathReferenceSchema,
    stepOutputReference: stepOutputReferenceSchema,
  })
  .optional()

// ─── Route ──────────────────────────────────────────────────────────────────

const ROUTE_DESCRIPTION = `
Run a list of commands in order under a single umbrella job. Used whenever you'd otherwise script multiple \`POST /commands/<name>\` calls in sequence — one job id, one SSE log stream, automatic teardown on first failure.

**Body shapes** (the route accepts either):

- \`{ "yaml": "<yaml string>" }\` — the same YAML the builder UI's *View YAML* modal shows. Parsed server-side.
- \`{ "paths": {...}, "steps": [...] }\` — pre-parsed JSON in the same document shape (\`ParsedSequenceBody\`).

**Param value forms.** Inside any \`steps[].params\` value, three shapes are recognized:

1. **Literal** — string, number, boolean, array, object. Passed through unchanged.
2. **\`'@pathId'\`** — string starting with \`@\`, names a key from the top-level \`paths\` map. Resolved to that path's \`value\` at runtime.
3. **\`{ linkedTo, output }\`** — references a previous step's output. \`output: 'folder'\` (or omitted) resolves to that step's synthesized output folder; any other value names a runtime output the source command publishes via its \`extractOutputs\` projector (e.g. \`computeDefaultSubtitleRules\` → \`'rules'\`).

**Resolution rules.** A step can only reference steps earlier in the array. References to a missing path/step/output fail the umbrella job with a clear error in the SSE log stream. Empty arrays / nullish values pass through; commands that should be conditional implement an empty-input no-op themselves (no \`if:\` predicate exists in the YAML).

**Per-command param schemas.** The shape of \`params\` for a given command matches the request body of \`POST /commands/<command>\` once any \`'@pathId'\` / \`{ linkedTo, output }\` references are resolved. Look up the per-command endpoint to see the exact required/optional fields and their types.

The full reference, including a worked anime-subtitle pipeline example, lives in [README.md](README.md) under "Sequence Runner — multi-step pipelines as YAML".
`.trim()

export const sequenceRoutes = new OpenAPIHono()

sequenceRoutes.openapi(
  createRoute({
    method: "post",
    path: "/sequences/run",
    summary:
      "Run a sequence of steps as a single umbrella job.",
    description: ROUTE_DESCRIPTION,
    tags: ["Sequence Runner"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: sequenceRequestSchema,
          },
        },
      },
    },
    responses: {
      202: {
        description:
          "Sequence job started. Subscribe to `/jobs/:id/logs` for the log stream.",
        content: {
          "application/json": {
            schema: sequenceResponseSchema,
          },
        },
      },
      400: {
        description:
          "Body did not match either accepted shape, or YAML failed to parse / validate.",
        content: {
          "application/json": {
            schema: z
              .object({
                error: z
                  .string()
                  .describe(
                    "Human-readable description of what went wrong.",
                  ),
              })
              .openapi({
                example: {
                  error: "Invalid YAML: YAMLException: …",
                },
              }),
          },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")

    let parsed: SequenceBody
    if ("yaml" in body) {
      let loaded: unknown
      try {
        loaded = yaml.load(body.yaml)
      } catch (error) {
        return context.json(
          { error: `Invalid YAML: ${String(error)}` },
          400,
        )
      }
      const validation =
        validatedParsedSequenceSchema.safeParse(loaded)
      if (!validation.success) {
        return context.json(
          {
            error: `YAML body did not match expected shape: ${validation.error.message}`,
          },
          400,
        )
      }
      parsed = validation.data
    } else {
      parsed = body
    }

    const job = createJob({
      // 'sequence' is not a registered command (the registry lives in
      // commandRoutes.commandNames; sequences come in via this separate
      // /sequences/run endpoint), so there's no collision risk in using
      // the bare name. The previous '__sequence__' was a defensive
      // namespacing artifact that just rendered ugly in the /jobs UI.
      commandName: "sequence",
      params: parsed,
    })

    runSequenceJob(job.id, parsed, {
      isUsingFake: isFakeRequest(context),
      globalScenario: getFakeScenario(context),
    })

    return context.json(
      {
        jobId: job.id,
        logsUrl: `/jobs/${job.id}/logs`,
      },
      202,
    )
  },
)
