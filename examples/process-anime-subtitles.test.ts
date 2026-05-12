import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  resolveSequenceParams,
  type StepRuntimeRecord,
} from "@media-tools/server/src/api/resolveSequenceParams.js"
import { commandConfigs } from "@media-tools/server/src/api/routes/commandRoutes.js"
import yaml from "js-yaml"
import { describe, expect, test } from "vitest"

// memfs is mocked in for `node:fs/promises` (see vitest.setup.ts), so the
// real on-disk YAML file isn't readable through that. We disable the mock
// for this one test using the dynamic import + an injected unmocked
// readFile via the node URL form. Easier: read it via Node's import.meta.
// Since vitest mocks `node:fs/promises`, reading the file at module-load
// time keeps it under the real fs.
const __dirname = dirname(fileURLToPath(import.meta.url))
const yamlPath = join(
  __dirname,
  "process-anime-subtitles.yaml",
)

describe("examples/process-anime-subtitles.yaml", () => {
  test("parses as YAML and validates the document shape (paths + steps with ids)", async () => {
    const raw = await readFileWithoutMock(yamlPath)
    const doc = yaml.load(raw) as {
      paths: Record<string, { value: string }>
      steps: Array<{
        id?: string
        command: string
        params?: Record<string, unknown>
      }>
    }

    expect(doc).toBeTruthy()
    expect(doc.paths.workDir.value).toBeTruthy()
    expect(doc.paths.parentDir.value).toBeTruthy()

    expect(Array.isArray(doc.steps)).toBe(true)
    expect(doc.steps.length).toBeGreaterThan(0)

    // Every step ships an `id` so downstream `linkedTo: …` references can hit it.
    doc.steps.forEach((step) => {
      expect(typeof step.id).toBe("string")
      expect(step.id).toMatch(/^[a-zA-Z][a-zA-Z0-9_]*$/)
    })
  })

  test("every command name in the example is registered in commandConfigs", async () => {
    const raw = await readFileWithoutMock(yamlPath)
    const doc = yaml.load(raw) as {
      steps: Array<{ command: string }>
    }
    const unknowns = doc.steps
      .map((step) => step.command)
      .filter(
        (name) => !Object.hasOwn(commandConfigs, name),
      )
    expect(unknowns).toEqual([])
  })

  test("every step's params resolve cleanly through the live resolver (links, paths, named outputs)", async () => {
    const raw = await readFileWithoutMock(yamlPath)
    const doc = yaml.load(raw) as {
      paths: Record<
        string,
        { label?: string; value: string }
      >
      steps: Array<{
        id: string
        command: string
        params?: Record<string, unknown>
      }>
    }

    const stepsById: Record<string, StepRuntimeRecord> = {}

    // Walk the steps in order, mirroring what sequenceRunner does. After
    // each step, fabricate a plausible runtime record so subsequent
    // { linkedTo, output: 'folder' } references can resolve. For the named
    // output ('rules'), just stuff a dummy array — the resolver only checks
    // existence by key, not content.
    doc.steps.forEach((step) => {
      const config =
        commandConfigs[
          step.command as keyof typeof commandConfigs
        ]
      const { resolved, errors } = resolveSequenceParams({
        rawParams: step.params ?? {},
        pathsById: doc.paths,
        stepsById,
        commandConfigsByName: commandConfigs,
      })

      expect(
        errors,
        `step "${step.id}" produced resolution errors`,
      ).toEqual([])
      expect(resolved).toBeTruthy()

      stepsById[step.id] = {
        command: step.command,
        outputs: config?.extractOutputs
          ? config.extractOutputs([
              {
                type: "setScriptInfo",
                key: "ScriptType",
                value: "v4.00+",
              },
            ])
          : null,
        resolvedParams: resolved,
      }
    })
  })
})

// vitest.setup.ts mocks node:fs and node:fs/promises with memfs for the
// whole repo. This example file is a real on-disk YAML that we *can't*
// stage through memfs, so we punch through the mock with vi.importActual.
async function readFileWithoutMock(
  path: string,
): Promise<string> {
  const real = await vi.importActual<
    typeof import("node:fs/promises")
  >("node:fs/promises")
  return real.readFile(path, "utf8")
}

// Local vi alias so the helper above can use it without polluting top-level imports.
import { vi } from "vitest"
