import { readFile } from "node:fs/promises"
import { vol } from "memfs"
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
} from "vitest"
import type { JobEvent } from "../jobStore.js"
import {
  cancelJob,
  getAllJobs,
  getChildJobs,
  getJob,
  getSubject,
  resetStore,
} from "../jobStore.js"
import {
  installLogCapture,
  uninstallLogCapture,
} from "../logCapture.js"
import { sequenceRoutes } from "./sequenceRoutes.js"

// Hono in-process testing: sequenceRoutes is just a Hono sub-app, so
// sequenceRoutes.request(url, init) drives it without spinning up a real
// server. The actual command observables inside each step run for real
// against memfs (vitest.setup.ts mocks node:fs globally), so a sequence of
// `makeDirectory` calls is a clean way to exercise the runner end-to-end:
// it produces an outputFolderName, the second step can link to it via
// { linkedTo, output: 'folder' }, and we can stat the result.

const post = (path: string, body: unknown) =>
  sequenceRoutes.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

const flushAfter = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

// Poll a predicate until it returns truthy or the budget expires. Used
// by cancellation tests to catch a step exactly while it's `running` —
// memfs is fast enough that a fixed `await flushAfter(20)` can race past
// the running window straight to `completed`.
const waitFor = async <T>(
  get: () => T | undefined,
  timeoutMs = 500,
): Promise<T> => {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const value = get()
    if (value !== undefined && value !== null) return value
    await new Promise<void>((resolve) =>
      setImmediate(resolve),
    )
  }
  throw new Error(
    `waitFor: predicate did not resolve within ${timeoutMs}ms`,
  )
}

// Install log capture once for the whole file so the SEQUENCE log lines
// emitted from runSequenceJob via console.info actually land on each
// job's logs array (the production server installs this once at startup;
// vitest doesn't, so we mirror the install here).
beforeAll(() => {
  installLogCapture()
})

afterAll(() => {
  uninstallLogCapture()
})

afterEach(() => {
  resetStore()
})

describe("POST /sequences/run", () => {
  test("returns 202 with a jobId + logsUrl for a valid pre-parsed body", async () => {
    const response = await post("/sequences/run", {
      paths: { workDir: { value: "/work" } },
      steps: [
        {
          command: "makeDirectory",
          params: { sourcePath: "@workDir" },
        },
      ],
    })

    expect(response.status).toBe(202)
    const body = (await response.json()) as {
      jobId: string
      logsUrl: string
    }
    expect(typeof body.jobId).toBe("string")
    expect(body.logsUrl).toBe(`/jobs/${body.jobId}/logs`)
  })

  // Regression: the deployed YAML/Builder emits path variables under the
  // canonical `variables` block (each tagged with type: "path"), not the
  // legacy `paths` block. A bug in sequenceRunner read only body.paths, so
  // every `@pathVariable_*` reference failed with "Unknown path variable".
  // This test pins the new shape to the resolver.
  test("resolves @pathId references that live under the canonical `variables` block", async () => {
    const response = await post("/sequences/run", {
      variables: {
        pathVariable_abc123: {
          label: "pathVariable_abc123",
          value: "/from-variables",
          type: "path",
        },
      },
      steps: [
        {
          command: "makeDirectory",
          params: { sourcePath: "@pathVariable_abc123" },
        },
      ],
    })
    const { jobId } = (await response.json()) as {
      jobId: string
    }

    await flushAfter(50)

    const job = getJob(jobId)
    expect(job?.status).toBe("completed")
    expect(job?.error).toBeNull()
  })

  test("rejects malformed YAML with a 400", async () => {
    const response = await post("/sequences/run", {
      yaml: "this is: : : invalid yaml",
    })
    expect(response.status).toBe(400)
  })

  test("rejects YAML whose parsed shape doesn't match the schema with a 400", async () => {
    const response = await post("/sequences/run", {
      yaml: "steps: not-an-array",
    })
    expect(response.status).toBe(400)
  })

  test("accepts a YAML string body and parses it server-side", async () => {
    const response = await post("/sequences/run", {
      yaml: [
        "paths:",
        "  workDir:",
        "    value: /work",
        "steps:",
        "  - command: makeDirectory",
        "    params:",
        "      sourcePath: '@workDir'",
      ].join("\n"),
    })
    expect(response.status).toBe(202)
  })

  test("runs every step, marks the umbrella job completed, and accumulates logs", async () => {
    const response = await post("/sequences/run", {
      paths: { root: { value: "/seq-root" } },
      steps: [
        {
          id: "first",
          command: "makeDirectory",
          params: { sourcePath: "@root" },
        },
        {
          id: "second",
          command: "makeDirectory",
          params: { sourcePath: "@root" },
        },
      ],
    })
    const { jobId } = (await response.json()) as {
      jobId: string
    }

    // The runner spins synchronously into rxjs subscribe callbacks; one tick
    // is enough for both makeDirectory observables to complete since memfs
    // is sync under the hood.
    await flushAfter(50)

    const completedJob = getJob(jobId)
    expect(completedJob?.status).toBe("completed")
    expect(completedJob?.error).toBeNull()

    // Both steps logged their start + end markers via the SEQUENCE prefix.
    const logsBlob = (completedJob?.logs ?? []).join("\n")
    expect(logsBlob).toContain("Step first")
    expect(logsBlob).toContain("Step second")
  })

  test("fails the umbrella job and surfaces the error when a step references an unknown path variable", async () => {
    const response = await post("/sequences/run", {
      steps: [
        {
          command: "makeDirectory",
          params: { sourcePath: "@missing" },
        },
      ],
    })
    const { jobId } = (await response.json()) as {
      jobId: string
    }

    await flushAfter(20)

    const job = getJob(jobId)
    expect(job?.status).toBe("failed")
    expect(job?.error).toMatch(/missing/i)
  })

  test("fails the umbrella job and stops the recursion when a step's command observable errors", async () => {
    // Regression for the "completed but had errors" bug: catchNamedError
    // returned EMPTY, swallowing errors before they reached the runner's
    // catchError handler. After splitting into logAndRethrowPipelineError (outer
    // terminal pipes) and logAndSwallowPipelineError (inner per-file pipes), an
    // app-command's error must propagate up to the umbrella status and
    // halt the recursive runStep advance.
    //
    // deleteFolder's confirm:false path is a clean way to drive a real
    // command observable to error: the runtime guard throws before any
    // I/O, the observable emits an error notification, the runner's
    // catchError marks the job failed, and the next step never starts.
    vol.fromJSON({
      "/work/keep-me": "data",
    })

    const response = await post("/sequences/run", {
      steps: [
        {
          id: "refuse",
          command: "deleteFolder",
          params: { sourcePath: "/work", confirm: false },
        },
        {
          id: "should-not-run",
          command: "makeDirectory",
          params: { sourcePath: "/never-created" },
        },
      ],
    })
    const { jobId } = (await response.json()) as {
      jobId: string
    }

    await flushAfter(50)

    const job = getJob(jobId)
    expect(job?.status).toBe("failed")
    expect(job?.error).toMatch(/confirm: true/i)

    // Second step must not have advanced — the recursion guard sees
    // status === "failed" and bails before runStep(stepIndex + 1).
    expect(vol.existsSync("/never-created")).toBe(false)
    // Original folder is preserved (refusal happens before any rm).
    expect(vol.existsSync("/work/keep-me")).toBe(true)
  })

  test("modifySubtitleMetadata with hasDefaultRules:true bumps ScriptType end-to-end through the sequence runner", async () => {
    // The standalone version of the rules pipeline: now that
    // computeDefaultSubtitleRules is gone, modifySubtitleMetadata runs the
    // default-rules heuristic itself when hasDefaultRules is true. Drives
    // a seeded .ass file through the sequence runner and asserts the
    // ScriptType bump from v4.00 → v4.00+ actually lands in the file.
    vol.fromJSON({
      "/seq/episode-01.ass":
        "[Script Info]\nScriptType: v4.00\nTitle: Test\n",
    })

    const response = await post("/sequences/run", {
      paths: { workDir: { value: "/seq" } },
      steps: [
        {
          id: "applyRules",
          command: "modifySubtitleMetadata",
          params: {
            sourcePath: "@workDir",
            hasDefaultRules: true,
            rules: [],
          },
        },
      ],
    })
    const { jobId } = (await response.json()) as {
      jobId: string
    }

    await flushAfter(100)

    const job = getJob(jobId)
    expect(job?.status).toBe("completed")
    expect(job?.error).toBeNull()

    const after = await readFile(
      "/seq/episode-01.ass",
      "utf8",
    )
    expect(after).toContain("ScriptType: v4.00+")
  })

  test("creates a child job per step linked to the umbrella via parentJobId, with correct stepId + commandName", async () => {
    const response = await post("/sequences/run", {
      paths: { root: { value: "/seq-children" } },
      steps: [
        {
          id: "alpha",
          command: "makeDirectory",
          params: { sourcePath: "@root" },
        },
        {
          command: "makeDirectory",
          params: { sourcePath: "@root" },
        },
      ],
    })
    const { jobId } = (await response.json()) as {
      jobId: string
    }

    await flushAfter(50)

    const children = getChildJobs(jobId)
    expect(children).toHaveLength(2)
    expect(children[0].commandName).toBe("makeDirectory")
    expect(children[0].stepId).toBe("alpha")
    // assignedCounter increments only for unnamed steps. The first step
    // had an explicit id ("alpha") and didn't consume a slot, so the
    // second (unnamed) step is the first auto-assigned id.
    expect(children[1].stepId).toBe("step1")
    expect(
      children.every(
        (child) => child.parentJobId === jobId,
      ),
    ).toBe(true)
    expect(
      children.every(
        (child) => child.status === "completed",
      ),
    ).toBe(true)
  })

  test("blank placeholder steps (command: '') are skipped — no child job, no error", async () => {
    // Builder UI persists blank cards in YAML so undo/redo and `?seq=`
    // round-trips don't drop them. The runner treats them as no-ops.
    const response = await post("/sequences/run", {
      paths: { root: { value: "/blank-skip" } },
      steps: [
        { id: "blank-1", command: "" },
        {
          id: "real",
          command: "makeDirectory",
          params: { sourcePath: "@root" },
        },
        { id: "blank-2", command: "" },
      ],
    })
    expect(response.status).toBe(202)
    const { jobId } = (await response.json()) as {
      jobId: string
    }

    await flushAfter(50)

    const children = getChildJobs(jobId)
    expect(children).toHaveLength(1)
    expect(children[0].stepId).toBe("real")
    expect(children[0].status).toBe("completed")
    expect(getJob(jobId)?.status).toBe("completed")
  })

  test("marks downstream child jobs as skipped when an earlier step fails", async () => {
    vol.fromJSON({ "/work/keep": "" })

    const response = await post("/sequences/run", {
      steps: [
        {
          id: "ok",
          command: "makeDirectory",
          params: { sourcePath: "/ok" },
        },
        {
          id: "boom",
          command: "deleteFolder",
          params: { sourcePath: "/work", confirm: false },
        },
        {
          id: "downstream1",
          command: "makeDirectory",
          params: { sourcePath: "/down1" },
        },
        {
          id: "downstream2",
          command: "makeDirectory",
          params: { sourcePath: "/down2" },
        },
      ],
    })
    const { jobId } = (await response.json()) as {
      jobId: string
    }

    await flushAfter(80)

    const children = getChildJobs(jobId)
    const byStepId = Object.fromEntries(
      children.map((child) => [child.stepId, child]),
    )

    expect(byStepId.ok.status).toBe("completed")
    expect(byStepId.boom.status).toBe("failed")
    expect(byStepId.downstream1.status).toBe("skipped")
    expect(byStepId.downstream2.status).toBe("skipped")

    // The runner must not have advanced into either downstream step's
    // observable — the directories are not on disk.
    expect(vol.existsSync("/down1")).toBe(false)
    expect(vol.existsSync("/down2")).toBe(false)
  })

  test("marks the offending step's child as failed when its params reference a missing path", async () => {
    const response = await post("/sequences/run", {
      steps: [
        {
          id: "broken",
          command: "makeDirectory",
          params: { sourcePath: "@missing" },
        },
        {
          id: "after",
          command: "makeDirectory",
          params: { sourcePath: "/never" },
        },
      ],
    })
    const { jobId } = (await response.json()) as {
      jobId: string
    }

    await flushAfter(20)

    const children = getChildJobs(jobId)
    const byStepId = Object.fromEntries(
      children.map((child) => [child.stepId, child]),
    )
    expect(byStepId.broken.status).toBe("failed")
    expect(byStepId.broken.error).toMatch(/missing/i)
    expect(byStepId.after.status).toBe("skipped")
  })

  test("umbrella sequence job has parentJobId=null so it stays at the top of the Jobs UI list", async () => {
    const response = await post("/sequences/run", {
      paths: { root: { value: "/top-level-check" } },
      steps: [
        {
          id: "only",
          command: "makeDirectory",
          params: { sourcePath: "@root" },
        },
      ],
    })
    const { jobId } = (await response.json()) as {
      jobId: string
    }

    await flushAfter(20)

    expect(getJob(jobId)?.parentJobId).toBeNull()
    expect(getJob(jobId)?.stepId).toBeNull()
    // Sanity: total jobs = 1 umbrella + 1 child.
    expect(getAllJobs()).toHaveLength(2)
  })

  test("rejects unknown command names with a 400 before any job is created", async () => {
    // The schema enumerates valid command names (`z.enum(commandNames)`)
    // so unknown commands are caught at validation time rather than
    // running the umbrella job and hitting the runner's defensive
    // unknown-command branch. Earlier validation = clearer failure mode
    // for API consumers.
    const response = await post("/sequences/run", {
      steps: [
        { command: "doesNotExist", params: {} },
        {
          command: "makeDirectory",
          params: { sourcePath: "/should-not-run" },
        },
      ],
    })
    expect(response.status).toBe(400)
  })
})

// Group-aware behavior. Bare-step entries continue to validate without
// `kind`, but the schema also accepts `{ kind: "group", steps: [...] }`
// container items at the top level. Groups don't nest — their inner
// steps must be bare steps. Two execution modes:
//   - `isParallel` omitted / false: serial loop inside the group; first
//     failure stops the group and cascades to outer remainder.
//   - `isParallel: true`: inner steps run concurrently via Promise.all.
//     Outputs of every successful inner step land in stepsById so a step
//     after the group can `linkedTo` any of them.
//
// Cross-item validation (unique step ids, no parallel-sibling links)
// happens at parse time so misconfigured YAML returns 400 instead of
// failing only at run-time.

describe("POST /sequences/run — groups", () => {
  test("accepts a top-level mix of bare steps and a kind:group container", async () => {
    const response = await post("/sequences/run", {
      paths: { root: { value: "/grp-mixed" } },
      steps: [
        {
          id: "before",
          command: "makeDirectory",
          params: { sourcePath: "@root" },
        },
        {
          kind: "group",
          id: "innerSerial",
          label: "Two serial steps",
          steps: [
            {
              id: "g1",
              command: "makeDirectory",
              params: { sourcePath: "@root" },
            },
            {
              id: "g2",
              command: "makeDirectory",
              params: { sourcePath: "@root" },
            },
          ],
        },
        {
          id: "after",
          command: "makeDirectory",
          params: { sourcePath: "@root" },
        },
      ],
    })
    expect(response.status).toBe(202)
    const { jobId } = (await response.json()) as {
      jobId: string
    }
    await flushAfter(80)

    const umbrella = getJob(jobId)
    expect(umbrella?.status).toBe("completed")

    // One child job per actual step — the group itself doesn't get a
    // child job; its identity lives only in the source YAML.
    const children = getChildJobs(jobId)
    expect(children.map((child) => child.stepId)).toEqual([
      "before",
      "g1",
      "g2",
      "after",
    ])
    expect(
      children.every(
        (child) => child.parentJobId === jobId,
      ),
    ).toBe(true)
    expect(
      children.every(
        (child) => child.status === "completed",
      ),
    ).toBe(true)
  })

  test("rejects a group with no inner steps via the schema (400)", async () => {
    const response = await post("/sequences/run", {
      steps: [{ kind: "group", steps: [] }],
    })
    expect(response.status).toBe(400)
  })

  test("rejects duplicate step ids across a group and the top level", async () => {
    // Sent as YAML so the handler's own 400 response (with the
    // formatted Zod error message) is what we inspect — the JSON-body
    // path runs through Hono's @hono/zod-openapi validator wrapper
    // which produces a different (and undocumented) error shape.
    const response = await post("/sequences/run", {
      yaml: [
        "steps:",
        "  - id: same",
        "    command: makeDirectory",
        "    params:",
        "      sourcePath: /a",
        "  - kind: group",
        "    steps:",
        "      - id: same",
        "        command: makeDirectory",
        "        params:",
        "          sourcePath: /b",
      ].join("\n"),
    })
    expect(response.status).toBe(400)
    const body = (await response.json()) as {
      error: string
    }
    expect(body.error.toLowerCase()).toContain(
      "duplicate step id",
    )
  })

  test("rejects linkedTo between siblings of the same parallel group", async () => {
    const response = await post("/sequences/run", {
      yaml: [
        "steps:",
        "  - kind: group",
        "    isParallel: true",
        "    steps:",
        "      - id: alpha",
        "        command: makeDirectory",
        "        params:",
        "          sourcePath: /alpha",
        "      - id: beta",
        "        command: copyFiles",
        "        params:",
        "          sourcePath:",
        "            linkedTo: alpha",
        "            output: folder",
        "          destinationPath: /dst",
      ].join("\n"),
    })
    expect(response.status).toBe(400)
    const body = (await response.json()) as {
      error: string
    }
    expect(body.error.toLowerCase()).toContain(
      "parallel group",
    )
  })

  test("serial group: inner steps run in document order and group failure cascades to outer remainder", async () => {
    vol.fromJSON({ "/work/keep": "" })

    const response = await post("/sequences/run", {
      steps: [
        {
          kind: "group",
          id: "boomGroup",
          steps: [
            {
              id: "innerOk",
              command: "makeDirectory",
              params: { sourcePath: "/inner-ok" },
            },
            {
              id: "innerBoom",
              command: "deleteFolder",
              params: {
                sourcePath: "/work",
                confirm: false,
              },
            },
            {
              id: "innerSkip",
              command: "makeDirectory",
              params: { sourcePath: "/inner-skip" },
            },
          ],
        },
        {
          id: "afterGroup",
          command: "makeDirectory",
          params: { sourcePath: "/after-group" },
        },
      ],
    })
    const { jobId } = (await response.json()) as {
      jobId: string
    }
    await flushAfter(80)

    const children = getChildJobs(jobId)
    const byStepId = Object.fromEntries(
      children.map((child) => [child.stepId, child]),
    )

    expect(byStepId.innerOk.status).toBe("completed")
    expect(byStepId.innerBoom.status).toBe("failed")
    // Inner siblings after the failure AND outer steps after the group
    // both get skipped — same fail-cascade as the flat-step case.
    expect(byStepId.innerSkip.status).toBe("skipped")
    expect(byStepId.afterGroup.status).toBe("skipped")

    expect(getJob(jobId)?.status).toBe("failed")
    expect(vol.existsSync("/inner-ok")).toBe(true)
    expect(vol.existsSync("/inner-skip")).toBe(false)
    expect(vol.existsSync("/after-group")).toBe(false)
  })

  test("parallel group: a step after the group can linkedTo an inner step's folder output", async () => {
    // Each parallel inner copyFiles publishes a synthesized folder
    // output equal to its destinationPath. The post-group step then
    // links to one of those folders — proves the runner records every
    // inner step's outputs into stepsById before advancing past the
    // group, so steps after the group can reference any of them.
    vol.fromJSON({
      "/src-a/alpha.txt": "alpha",
      "/src-b/beta.txt": "beta",
      "/src-after/follow-up.txt": "after",
    })

    const response = await post("/sequences/run", {
      steps: [
        {
          kind: "group",
          id: "paraSources",
          isParallel: true,
          steps: [
            {
              id: "copyA",
              command: "copyFiles",
              params: {
                sourcePath: "/src-a",
                destinationPath: "/dst-a",
              },
            },
            {
              id: "copyB",
              command: "copyFiles",
              params: {
                sourcePath: "/src-b",
                destinationPath: "/dst-b",
              },
            },
          ],
        },
        {
          id: "consume",
          command: "copyFiles",
          params: {
            sourcePath: "/src-after",
            destinationPath: {
              linkedTo: "copyA",
              output: "folder",
            },
          },
        },
      ],
    })
    const { jobId } = (await response.json()) as {
      jobId: string
    }
    await flushAfter(150)

    const job = getJob(jobId)
    expect(job?.status).toBe("completed")
    expect(job?.error).toBeNull()

    const children = getChildJobs(jobId)
    const byStepId = Object.fromEntries(
      children.map((child) => [child.stepId, child]),
    )
    expect(byStepId.copyA.status).toBe("completed")
    expect(byStepId.copyB.status).toBe("completed")
    expect(byStepId.consume.status).toBe("completed")

    // Both parallel inner copies happened, and the after-group step
    // copied /src-after/follow-up.txt into /dst-a (the folder output
    // it linked to) — that one file is the proof that the linkedTo
    // resolved through to the inner step's destination.
    expect(vol.existsSync("/dst-a/alpha.txt")).toBe(true)
    expect(vol.existsSync("/dst-b/beta.txt")).toBe(true)
    expect(vol.existsSync("/dst-a/follow-up.txt")).toBe(
      true,
    )
  })

  test("parallel group fail: outer remainder is skipped, sibling success still recorded", async () => {
    vol.fromJSON({ "/work/keep": "" })

    const response = await post("/sequences/run", {
      steps: [
        {
          kind: "group",
          id: "paraBoom",
          isParallel: true,
          steps: [
            {
              id: "innerSuccess",
              command: "makeDirectory",
              params: { sourcePath: "/inner-success" },
            },
            {
              id: "innerBoom",
              command: "deleteFolder",
              params: {
                sourcePath: "/work",
                confirm: false,
              },
            },
          ],
        },
        {
          id: "afterGroup",
          command: "makeDirectory",
          params: { sourcePath: "/after-group" },
        },
      ],
    })
    const { jobId } = (await response.json()) as {
      jobId: string
    }
    await flushAfter(80)

    const children = getChildJobs(jobId)
    const byStepId = Object.fromEntries(
      children.map((child) => [child.stepId, child]),
    )

    expect(byStepId.innerSuccess.status).toBe("completed")
    expect(byStepId.innerBoom.status).toBe("failed")
    expect(byStepId.afterGroup.status).toBe("skipped")
    expect(getJob(jobId)?.status).toBe("failed")
    expect(vol.existsSync("/after-group")).toBe(false)
  })

  test("parallel group fail-fast: in-flight sibling is cancelled, not allowed to complete", async () => {
    // Seed enough files in /slow-src that copyFiles is still working
    // through them when the fast-failing sibling rejects. Once the
    // failure broadcast fires, the slow sibling's runJob subscription
    // is unsubscribed; copyFiles' internal AbortController aborts the
    // in-flight stream pipeline; the child job's status flips to
    // `cancelled` (NOT `completed`). The proof point: at least one
    // source file did not make it into the destination, because the
    // copy was interrupted mid-iteration.
    const seedFiles: Record<string, string> = {
      "/work/keep": "",
    }
    for (let index = 0; index < 64; index += 1) {
      seedFiles[`/slow-src/file${index}.txt`] =
        "padding-".repeat(500) + index
    }
    vol.fromJSON(seedFiles)

    const response = await post("/sequences/run", {
      steps: [
        {
          kind: "group",
          id: "paraCancel",
          isParallel: true,
          steps: [
            {
              id: "slow",
              command: "copyFiles",
              params: {
                sourcePath: "/slow-src",
                destinationPath: "/slow-dst",
              },
            },
            {
              id: "boom",
              command: "deleteFolder",
              params: {
                sourcePath: "/work",
                confirm: false,
              },
            },
          ],
        },
        {
          id: "after",
          command: "makeDirectory",
          params: { sourcePath: "/after" },
        },
      ],
    })
    const { jobId } = (await response.json()) as {
      jobId: string
    }
    await flushAfter(200)

    const children = getChildJobs(jobId)
    const byStepId = Object.fromEntries(
      children.map((child) => [child.stepId, child]),
    )

    expect(byStepId.boom.status).toBe("failed")
    expect(byStepId.slow.status).toBe("cancelled")
    expect(byStepId.after.status).toBe("skipped")
    expect(getJob(jobId)?.status).toBe("failed")
    expect(vol.existsSync("/after")).toBe(false)
  })

  test("parallel group: inner steps actually run concurrently (lifetimes overlap)", async () => {
    // Promise.all in the runner subscribes to every inner-step
    // observable synchronously before any of them get to do work, so
    // each child's `startedAt` lands before any sibling's
    // `completedAt`. Equivalent: the two children's lifetimes overlap
    // (each started while the other was still running).
    //
    // Seed enough copyFiles work that the operations have to yield to
    // the event loop a few times — copyFiles awaits fs.readdir and
    // fs.copyFile, which gives the parallel sibling a turn. Serial
    // execution would force child2.startedAt > child1.completedAt and
    // the overlap assertion would fail.
    const seedFiles: Record<string, string> = {}
    for (let idx = 0; idx < 8; idx += 1) {
      seedFiles[`/par-src-a/file${idx}.txt`] =
        "alpha-".repeat(100) + idx
      seedFiles[`/par-src-b/file${idx}.txt`] =
        "beta-".repeat(100) + idx
    }
    vol.fromJSON(seedFiles)

    const response = await post("/sequences/run", {
      steps: [
        {
          kind: "group",
          id: "para",
          isParallel: true,
          steps: [
            {
              id: "concA",
              command: "copyFiles",
              params: {
                sourcePath: "/par-src-a",
                destinationPath: "/par-dst-a",
              },
            },
            {
              id: "concB",
              command: "copyFiles",
              params: {
                sourcePath: "/par-src-b",
                destinationPath: "/par-dst-b",
              },
            },
          ],
        },
      ],
    })
    const { jobId } = (await response.json()) as {
      jobId: string
    }
    await flushAfter(150)

    expect(getJob(jobId)?.status).toBe("completed")

    const children = getChildJobs(jobId)
    const childA = children.find(
      (child) => child.stepId === "concA",
    )
    const childB = children.find(
      (child) => child.stepId === "concB",
    )
    expect(childA?.status).toBe("completed")
    expect(childB?.status).toBe("completed")
    const aStart = childA?.startedAt?.getTime()
    const aEnd = childA?.completedAt?.getTime()
    const bStart = childB?.startedAt?.getTime()
    const bEnd = childB?.completedAt?.getTime()
    expect(typeof aStart).toBe("number")
    expect(typeof aEnd).toBe("number")
    expect(typeof bStart).toBe("number")
    expect(typeof bEnd).toBe("number")

    // Lifetimes overlap: each step started before the other completed.
    // This is the proof of concurrent execution — serial would have
    // bStart > aEnd (or vice versa), violating one of these.
    expect(bStart ?? 0).toBeLessThan(aEnd ?? 0)
    expect(aStart ?? 0).toBeLessThan(bEnd ?? 0)
  })

  test("cancelling a single child step cancels the umbrella and skips remaining steps", async () => {
    // Seed enough work that the first step is still running when we
    // call cancelJob on it. The remaining steps have not yet started —
    // they're still `pending`. Without the cancel-cascade fix, the
    // runner would `return` on the cancelled outcome but leave the
    // umbrella in `running` and the rest in `pending` forever.
    const seedFiles: Record<string, string> = {}
    for (let index = 0; index < 256; index += 1) {
      seedFiles[`/cancel-src/file${index}.txt`] =
        "padding-".repeat(2000) + index
    }
    vol.fromJSON(seedFiles)

    const response = await post("/sequences/run", {
      steps: [
        {
          id: "first",
          command: "copyFiles",
          params: {
            sourcePath: "/cancel-src",
            destinationPath: "/cancel-dst",
          },
        },
        {
          id: "second",
          command: "makeDirectory",
          params: { sourcePath: "/should-not-run" },
        },
        {
          id: "third",
          command: "makeDirectory",
          params: { sourcePath: "/also-should-not-run" },
        },
      ],
    })
    const { jobId } = (await response.json()) as {
      jobId: string
    }

    // Catch the first child exactly while it's running and cancel it
    // immediately — memfs is fast enough that a fixed wait can race
    // past the running window.
    const firstChild = await waitFor(() =>
      getChildJobs(jobId).find(
        (child) =>
          child.stepId === "first" &&
          child.status === "running",
      ),
    )
    cancelJob(firstChild.id)
    await flushAfter(100)

    const children = getChildJobs(jobId)
    const byStepId = Object.fromEntries(
      children.map((child) => [child.stepId, child]),
    )

    expect(byStepId.first.status).toBe("cancelled")
    expect(byStepId.second.status).toBe("skipped")
    expect(byStepId.third.status).toBe("skipped")
    expect(getJob(jobId)?.status).toBe("cancelled")
    expect(vol.existsSync("/should-not-run")).toBe(false)
    expect(vol.existsSync("/also-should-not-run")).toBe(
      false,
    )
  })

  test("cancelling one parallel sibling cancels the others and finalizes the umbrella", async () => {
    // Same shape as the cancel-cascade test, but inside a parallel
    // group. Cancelling one in-flight sibling should broadcast to the
    // others (cancelOrSkipJob), the group settles, the after-group
    // step is skipped, and the umbrella is cancelled.
    const seedFiles: Record<string, string> = {}
    for (let index = 0; index < 256; index += 1) {
      seedFiles[`/par-cancel-a/file${index}.txt`] =
        "alpha-".repeat(2000) + index
      seedFiles[`/par-cancel-b/file${index}.txt`] =
        "beta-".repeat(2000) + index
    }
    vol.fromJSON(seedFiles)

    const response = await post("/sequences/run", {
      steps: [
        {
          kind: "group",
          id: "paraCancelGroup",
          isParallel: true,
          steps: [
            {
              id: "innerA",
              command: "copyFiles",
              params: {
                sourcePath: "/par-cancel-a",
                destinationPath: "/par-cancel-a-dst",
              },
            },
            {
              id: "innerB",
              command: "copyFiles",
              params: {
                sourcePath: "/par-cancel-b",
                destinationPath: "/par-cancel-b-dst",
              },
            },
          ],
        },
        {
          id: "afterGroup",
          command: "makeDirectory",
          params: { sourcePath: "/after-cancel-group" },
        },
      ],
    })
    const { jobId } = (await response.json()) as {
      jobId: string
    }

    const innerA = await waitFor(() =>
      getChildJobs(jobId).find(
        (child) =>
          child.stepId === "innerA" &&
          child.status === "running",
      ),
    )
    cancelJob(innerA.id)
    await flushAfter(200)

    const children = getChildJobs(jobId)
    const byStepId = Object.fromEntries(
      children.map((child) => [child.stepId, child]),
    )

    expect(byStepId.innerA.status).toBe("cancelled")
    expect(byStepId.innerB.status).toBe("cancelled")
    expect(byStepId.afterGroup.status).toBe("skipped")
    expect(getJob(jobId)?.status).toBe("cancelled")
    expect(vol.existsSync("/after-cancel-group")).toBe(
      false,
    )
  })

  test("emits step-started and step-finished on the umbrella subject", async () => {
    // Each runOneStep call inside the sequence runner emits a structured
    // step-started event on the UMBRELLA subject just before it
    // subscribes the child observable, and a step-finished event the
    // moment the child outcome is decided. The builder's "Run via API"
    // modal subscribes to /jobs/<umbrella>/logs and uses these to follow
    // which child is active, so it can wire up that child's
    // ProgressEvent stream (which fires on the CHILD subject, not the
    // umbrella's).
    //
    // Seed enough work in step 1 so it's still running when the test
    // resumes from the response and subscribes to the umbrella subject.
    // Step 1's step-started fires synchronously inside runSequenceJob
    // (before the await response.json() resolves) so we deliberately
    // catch step1-finished, step2-started, step2-finished.
    const seedFiles: Record<string, string> = {}
    for (let index = 0; index < 64; index += 1) {
      seedFiles[`/step-event-src/file${index}.txt`] =
        "padding-".repeat(500) + index
    }
    vol.fromJSON(seedFiles)

    const response = await post("/sequences/run", {
      steps: [
        {
          id: "first",
          command: "copyFiles",
          params: {
            sourcePath: "/step-event-src",
            destinationPath: "/step-event-dst",
          },
        },
        {
          id: "second",
          command: "makeDirectory",
          params: { sourcePath: "/step-event-after" },
        },
      ],
    })
    const { jobId } = (await response.json()) as {
      jobId: string
    }

    const subject = getSubject(jobId)
    expect(subject).toBeDefined()
    const events: JobEvent[] = []
    subject?.subscribe((event) => {
      if (typeof event !== "string") events.push(event)
    })

    await flushAfter(200)

    const isStepEvent = (
      event: JobEvent | undefined,
      type: string,
      stepId: string,
    ): boolean =>
      event !== undefined &&
      event.type === type &&
      (event as { stepId: string | null }).stepId === stepId
    const stepEvents = events.filter(
      (event) =>
        event.type === "step-started" ||
        event.type === "step-finished",
    )
    const firstFinished = stepEvents.find((event) =>
      isStepEvent(event, "step-finished", "first"),
    )
    const secondStarted = stepEvents.find((event) =>
      isStepEvent(event, "step-started", "second"),
    )
    const secondFinished = stepEvents.find((event) =>
      isStepEvent(event, "step-finished", "second"),
    )

    expect(firstFinished).toBeDefined()
    expect(secondStarted).toBeDefined()
    expect(secondFinished).toBeDefined()

    // Each event must carry the corresponding child job id so the modal
    // can open /jobs/<childJobId>/logs without parsing log text.
    const children = getChildJobs(jobId)
    const byStepId = Object.fromEntries(
      children.map((child) => [child.stepId, child.id]),
    )

    type StepEventLike = {
      type: string
      childJobId: string
      stepId: string | null
      status: string
    }
    expect(
      (firstFinished as StepEventLike).childJobId,
    ).toBe(byStepId.first)
    expect(
      (secondStarted as StepEventLike).childJobId,
    ).toBe(byStepId.second)
    expect(
      (secondFinished as StepEventLike).childJobId,
    ).toBe(byStepId.second)

    // step-finished's `status` mirrors the child's terminal status — the
    // modal uses this to know when to tear down the open per-child SSE.
    expect((firstFinished as StepEventLike).status).toBe(
      "completed",
    )
    expect((secondFinished as StepEventLike).status).toBe(
      "completed",
    )
    // step-started always carries `running` since the child has just
    // transitioned past the runner's pre-subscribe validation.
    expect((secondStarted as StepEventLike).status).toBe(
      "running",
    )
  })

  test("step-finished status reflects a failed child", async () => {
    // Slow step 1 keeps the umbrella subject alive long enough for the
    // test to subscribe before any step-finished events fire. Step 2
    // then fails synchronously (deleteFolder with confirm:false against
    // a non-empty path) and we assert its step-finished carries
    // status: "failed".
    const seedFiles: Record<string, string> = {
      "/step-fail-work/keep": "",
    }
    for (let index = 0; index < 64; index += 1) {
      seedFiles[`/step-fail-src/file${index}.txt`] =
        "padding-".repeat(500) + index
    }
    vol.fromJSON(seedFiles)

    const response = await post("/sequences/run", {
      steps: [
        {
          id: "slow",
          command: "copyFiles",
          params: {
            sourcePath: "/step-fail-src",
            destinationPath: "/step-fail-dst",
          },
        },
        {
          id: "boom",
          command: "deleteFolder",
          params: {
            sourcePath: "/step-fail-work",
            confirm: false,
          },
        },
      ],
    })
    const { jobId } = (await response.json()) as {
      jobId: string
    }

    const events: JobEvent[] = []
    getSubject(jobId)?.subscribe((event) => {
      if (typeof event !== "string") events.push(event)
    })

    await flushAfter(200)

    const boomFinished = events.find(
      (event) =>
        event.type === "step-finished" &&
        (event as { stepId: string | null }).stepId ===
          "boom",
    )
    expect(boomFinished).toBeDefined()
    expect(
      (boomFinished as { status: string }).status,
    ).toBe("failed")
  })

  test("isCollapsed on a step parses without affecting runtime", async () => {
    // isCollapsed is pure view state. It must not perturb either the
    // child-job creation pass or the runtime — a sequence with a
    // collapsed step still runs that step end-to-end.
    vol.fromJSON({})
    const response = await post("/sequences/run", {
      steps: [
        {
          id: "collapsed",
          command: "makeDirectory",
          params: { sourcePath: "/collapsed-runs" },
          isCollapsed: true,
        },
      ],
    })
    expect(response.status).toBe(202)
    const { jobId } = (await response.json()) as {
      jobId: string
    }
    await flushAfter(40)
    expect(getJob(jobId)?.status).toBe("completed")
    expect(vol.existsSync("/collapsed-runs")).toBe(true)
  })

  // ─── P0 dry-run safety guard ──────────────────────────────────────────────
  //
  // The user lost real files when "Dry Run" was on because the client
  // wasn't forwarding the flag and the server ran deleteFolder for real.
  // The client now appends `?fake=success` (or `?fake=failure`) for dry-run.
  // These tests are the server-side contract for that flag: when the
  // sequence route is hit with `?fake=...`, the real command observables
  // (including deleteFolder) must NOT execute against the filesystem.
  //
  // These tests intentionally target deleteFolder specifically — it is
  // THE command whose real execution caused the data loss.
  describe("dry-run safety — ?fake=success disables real deleteFolder", () => {
    test("deleteFolder via ?fake=success leaves the target folder intact", async () => {
      // memfs setup: a folder that, if deleteFolder ran for real,
      // would be wiped.
      vol.fromJSON({
        "/precious/keep-me.txt": "irreplaceable",
        "/precious/nested/also-keep-me.bin":
          "also-irreplaceable",
      })

      const response = await post(
        "/sequences/run?fake=success",
        {
          steps: [
            {
              id: "doomed_if_real",
              command: "deleteFolder",
              params: {
                sourcePath: "/precious",
                confirm: true,
              },
            },
          ],
        },
      )
      expect(response.status).toBe(202)
      const { jobId } = (await response.json()) as {
        jobId: string
      }

      // Fake observables resolve quickly (capped at 400ms by
      // TIMING_OVERRIDES for deleteFolder); give it a generous window.
      await flushAfter(600)

      // The job must still complete (the fake path emits success).
      expect(getJob(jobId)?.status).toBe("completed")
      // The folder MUST still exist. If this assertion fails, the
      // fake path is broken and dry-run is data-loss-unsafe.
      expect(vol.existsSync("/precious")).toBe(true)
      expect(vol.existsSync("/precious/keep-me.txt")).toBe(
        true,
      )
      expect(
        vol.existsSync("/precious/nested/also-keep-me.bin"),
      ).toBe(true)
    })

    test("deleteFolder via ?fake=failure leaves the target folder intact (and the job fails as instructed)", async () => {
      vol.fromJSON({
        "/precious-failure/keep-me.txt":
          "irreplaceable-failure",
      })

      const response = await post(
        "/sequences/run?fake=failure",
        {
          steps: [
            {
              id: "doomed_if_real",
              command: "deleteFolder",
              params: {
                sourcePath: "/precious-failure",
                confirm: true,
              },
            },
          ],
        },
      )
      expect(response.status).toBe(202)
      const { jobId } = (await response.json()) as {
        jobId: string
      }

      // failureScenario emits N progress events on a setInterval before
      // throwing; the total wall-clock varies with the command's
      // TIMING_OVERRIDE. Poll until the job reaches a terminal state.
      await waitFor(() => {
        const status = getJob(jobId)?.status
        return status === "failed" || status === "completed"
          ? status
          : undefined
      }, 3000)

      // The fake-failure scenario emits an error, so the umbrella
      // job is failed — but the folder must NOT have been touched.
      expect(getJob(jobId)?.status).toBe("failed")
      expect(vol.existsSync("/precious-failure")).toBe(true)
      expect(
        vol.existsSync("/precious-failure/keep-me.txt"),
      ).toBe(true)
    })

    // Control: without ?fake=*, the REAL deleteFolder runs and the
    // folder is gone. This proves the test fixture would otherwise
    // delete — i.e. the safety above is meaningful, not a memfs quirk.
    test("CONTROL: deleteFolder WITHOUT ?fake actually deletes the folder", async () => {
      vol.fromJSON({
        "/control-doomed/keep-me.txt": "this will go",
      })

      const response = await post("/sequences/run", {
        steps: [
          {
            id: "real_delete",
            command: "deleteFolder",
            params: {
              sourcePath: "/control-doomed",
              confirm: true,
            },
          },
        ],
      })
      const { jobId } = (await response.json()) as {
        jobId: string
      }
      await flushAfter(40)

      expect(getJob(jobId)?.status).toBe("completed")
      expect(vol.existsSync("/control-doomed")).toBe(false)
    })
  })

  // ───────────────────────────────────────────────────────────────────
  // exitIfEmpty — planned early-exit
  //
  // The user-visible contract: a sequence whose first interesting step
  // ("did the copy bring anything in?") finds nothing should NOT mark the
  // umbrella job as failed (the failure webhook fires on failed → HA
  // pages on every no-files-to-process tick) and should NOT mark it as
  // completed either (we didn't actually do the work). The new `exited`
  // status is the honest answer; later flat steps cascade to `exited`
  // too because they never ran by design, not because something failed.
  // ───────────────────────────────────────────────────────────────────
  describe("exitIfEmpty — planned early-exit", () => {
    test("missing sourcePath → umbrella job becomes 'exited' and later steps cascade to 'exited' (not 'skipped' or 'failed')", async () => {
      const response = await post("/sequences/run", {
        paths: { workDir: { value: "/no-such-folder" } },
        steps: [
          {
            id: "guard",
            command: "exitIfEmpty",
            params: { sourcePath: "@workDir" },
          },
          {
            id: "wouldRun",
            command: "makeDirectory",
            params: { sourcePath: "@workDir" },
          },
        ],
      })
      const { jobId } = (await response.json()) as {
        jobId: string
      }
      await flushAfter(60)

      const umbrella = getJob(jobId)
      expect(umbrella?.status).toBe("exited")
      expect(umbrella?.error).toBeNull()

      const children = getChildJobs(jobId)
      const guardChild = children.find(
        (child) => child.stepId === "guard",
      )
      const wouldRunChild = children.find(
        (child) => child.stepId === "wouldRun",
      )
      // The guard step itself ran successfully — `completed` is honest.
      // It's the SEQUENCE that exited, not the step.
      expect(guardChild?.status).toBe("completed")
      // The later step never ran by design — cascade is `exited`.
      expect(wouldRunChild?.status).toBe("exited")
    })

    test("empty (but existing) sourcePath → same 'exited' cascade as missing", async () => {
      vol.fromJSON({ "/empty-dir/.keep": "" })
      vol.unlinkSync("/empty-dir/.keep")

      const response = await post("/sequences/run", {
        paths: { workDir: { value: "/empty-dir" } },
        steps: [
          {
            id: "guard",
            command: "exitIfEmpty",
            params: { sourcePath: "@workDir" },
          },
          {
            id: "wouldRun",
            command: "makeDirectory",
            params: { sourcePath: "@workDir" },
          },
        ],
      })
      const { jobId } = (await response.json()) as {
        jobId: string
      }
      await flushAfter(60)

      expect(getJob(jobId)?.status).toBe("exited")
      const children = getChildJobs(jobId)
      expect(
        children.find(
          (child) => child.stepId === "wouldRun",
        )?.status,
      ).toBe("exited")
    })

    test("non-empty sourcePath → guard is a no-op, sequence runs every step", async () => {
      vol.fromJSON({ "/work/file.mkv": "data" })

      const response = await post("/sequences/run", {
        paths: { workDir: { value: "/work" } },
        steps: [
          {
            id: "guard",
            command: "exitIfEmpty",
            params: { sourcePath: "@workDir" },
          },
          {
            id: "alsoRuns",
            command: "makeDirectory",
            params: { sourcePath: "@workDir" },
          },
        ],
      })
      const { jobId } = (await response.json()) as {
        jobId: string
      }
      await flushAfter(60)

      expect(getJob(jobId)?.status).toBe("completed")
      const children = getChildJobs(jobId)
      children.forEach((child) => {
        expect(child.status).toBe("completed")
      })
    })

    // Regression test for the original prod outage: in HA's anime-sync
    // sequence, the second step (`keepLanguages` in real life,
    // `deleteFolder` here as a stand-in — both ENOENT on a missing
    // sourcePath) was tanking the umbrella job to `failed` every hour.
    // With `exitIfEmpty` placed before it, the would-be-failing step
    // must never run; the umbrella becomes `exited`, not `failed`; no
    // ENOENT lands in the umbrella's error field.
    test("short-circuits a sequence whose next step would have ENOENT'd on the missing path", async () => {
      const response = await post("/sequences/run", {
        paths: { workDir: { value: "/no-such-work-folder" } },
        steps: [
          {
            id: "guard",
            command: "exitIfEmpty",
            params: { sourcePath: "@workDir" },
          },
          {
            id: "wouldHaveFailed",
            command: "deleteFolder",
            params: {
              sourcePath: "@workDir",
              confirm: true,
            },
          },
        ],
      })
      const { jobId } = (await response.json()) as {
        jobId: string
      }
      await flushAfter(60)

      const umbrella = getJob(jobId)
      expect(umbrella?.status).toBe("exited")
      expect(umbrella?.error).toBeNull()

      const children = getChildJobs(jobId)
      const wouldHaveFailedChild = children.find(
        (child) => child.stepId === "wouldHaveFailed",
      )
      // The whole point of the guard — this step must not have run,
      // and must carry the `exited` cascade status (not `failed`,
      // which is what we'd see without the guard, and not `skipped`,
      // which would have implied an earlier failure).
      expect(wouldHaveFailedChild?.status).toBe("exited")
      expect(wouldHaveFailedChild?.error).toBeNull()
    })

    // The runner has three loop branches (plain top-level step, serial
    // group, parallel group). The earlier `exitIfEmpty` tests only
    // directly exercised the plain-step branch — this test pins the
    // serial-group branch so a future runner refactor can't quietly
    // break it for users who organize their YAML into groups.
    test("inside a serial group, finalizes the umbrella as `exited` and cascades to items after the group", async () => {
      const response = await post("/sequences/run", {
        paths: { workDir: { value: "/no-such-folder" } },
        steps: [
          {
            kind: "group",
            id: "preflight",
            isParallel: false,
            steps: [
              {
                id: "guard",
                command: "exitIfEmpty",
                params: { sourcePath: "@workDir" },
              },
              {
                id: "wouldRunInGroup",
                command: "makeDirectory",
                params: { sourcePath: "@workDir" },
              },
            ],
          },
          {
            id: "afterGroup",
            command: "makeDirectory",
            params: { sourcePath: "@workDir" },
          },
        ],
      })
      const { jobId } = (await response.json()) as {
        jobId: string
      }
      await flushAfter(60)

      const umbrella = getJob(jobId)
      expect(umbrella?.status).toBe("exited")
      expect(umbrella?.error).toBeNull()

      const children = getChildJobs(jobId)
      const guardChild = children.find(
        (child) => child.stepId === "guard",
      )
      const inGroupChild = children.find(
        (child) => child.stepId === "wouldRunInGroup",
      )
      const afterGroupChild = children.find(
        (child) => child.stepId === "afterGroup",
      )

      // Guard ran successfully (the step did its job).
      expect(guardChild?.status).toBe("completed")
      // Sibling inside the same group never ran by design.
      expect(inGroupChild?.status).toBe("exited")
      // Outer step after the group also cascades.
      expect(afterGroupChild?.status).toBe("exited")
    })
  })
})
