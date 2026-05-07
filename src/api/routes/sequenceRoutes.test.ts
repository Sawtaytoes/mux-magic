import { readFile } from "node:fs/promises"
import { vol } from "memfs"
import { afterEach, beforeAll, afterAll, describe, expect, test } from "vitest"

import { getAllJobs, getChildJobs, getJob, resetStore } from "../jobStore.js"
import { installLogCapture, uninstallLogCapture } from "../logCapture.js"
import { sequenceRoutes } from "./sequenceRoutes.js"

// Hono in-process testing: sequenceRoutes is just a Hono sub-app, so
// sequenceRoutes.request(url, init) drives it without spinning up a real
// server. The actual command observables inside each step run for real
// against memfs (vitest.setup.ts mocks node:fs globally), so a sequence of
// `makeDirectory` calls is a clean way to exercise the runner end-to-end:
// it produces an outputFolderName, the second step can link to it via
// { linkedTo, output: 'folder' }, and we can stat the result.

const post = (path: string, body: unknown) => (
  sequenceRoutes.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
)

const flushAfter = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

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
      steps: [{ command: "makeDirectory", params: { filePath: "@workDir" } }],
    })

    expect(response.status).toBe(202)
    const body = await response.json() as { jobId: string, logsUrl: string }
    expect(typeof body.jobId).toBe("string")
    expect(body.logsUrl).toBe(`/jobs/${body.jobId}/logs`)
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
        "      filePath: '@workDir'",
      ].join("\n"),
    })
    expect(response.status).toBe(202)
  })

  test("runs every step, marks the umbrella job completed, and accumulates logs", async () => {
    const response = await post("/sequences/run", {
      paths: { root: { value: "/seq-root" } },
      steps: [
        { id: "first", command: "makeDirectory", params: { filePath: "@root" } },
        { id: "second", command: "makeDirectory", params: { filePath: "@root" } },
      ],
    })
    const { jobId } = await response.json() as { jobId: string }

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
      steps: [{ command: "makeDirectory", params: { filePath: "@missing" } }],
    })
    const { jobId } = await response.json() as { jobId: string }

    await flushAfter(20)

    const job = getJob(jobId)
    expect(job?.status).toBe("failed")
    expect(job?.error).toMatch(/missing/i)
  })

  test("fails the umbrella job and stops the recursion when a step's command observable errors", async () => {
    // Regression for the "completed but had errors" bug: catchNamedError
    // returned EMPTY, swallowing errors before they reached the runner's
    // catchError handler. After splitting into logAndRethrow (outer
    // terminal pipes) and logAndSwallow (inner per-file pipes), an
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
        { id: "refuse", command: "deleteFolder", params: { folderPath: "/work", confirm: false } },
        { id: "should-not-run", command: "makeDirectory", params: { filePath: "/never-created" } },
      ],
    })
    const { jobId } = await response.json() as { jobId: string }

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

  test("flattens single array emissions into named outputs so { linkedTo, output } resolves to a flat list", async () => {
    // Regression: sequenceRunner used to push() each emission, while
    // jobRunner concat()s them — so an observable emitting a single
    // rules-array (e.g. computeDefaultSubtitleRules) would land here as
    // [[rule1, rule2]] and the downstream `linkedTo: …, output: 'rules'`
    // resolved to an array-of-array. modifySubtitleMetadata's reduce then
    // saw each "rule" as an array (no .type), fell through its switch, and
    // wrote files back unchanged — sequence reported "completed" with no
    // visible changes. Driving compute → modify end-to-end against a
    // seeded .ass file proves the projection now matches jobRunner: the
    // ScriptType bump from v4.00 → v4.00+ actually lands in the file.
    vol.fromJSON({
      "G:\\Seq\\episode-01.ass": "[Script Info]\nScriptType: v4.00\nTitle: Test\n",
    })

    const response = await post("/sequences/run", {
      paths: { workDir: { value: "G:\\Seq" } },
      steps: [
        { id: "compRules", command: "computeDefaultSubtitleRules", params: { sourcePath: "@workDir" } },
        {
          id: "applyRules",
          command: "modifySubtitleMetadata",
          params: {
            sourcePath: "@workDir",
            rules: { linkedTo: "compRules", output: "rules" },
          },
        },
      ],
    })
    const { jobId } = await response.json() as { jobId: string }

    await flushAfter(100)

    const job = getJob(jobId)
    expect(job?.status).toBe("completed")
    expect(job?.error).toBeNull()

    const after = await readFile("G:\\Seq\\episode-01.ass", "utf8")
    expect(after).toContain("ScriptType: v4.00+")
  })

  test("creates a child job per step linked to the umbrella via parentJobId, with correct stepId + commandName", async () => {
    const response = await post("/sequences/run", {
      paths: { root: { value: "/seq-children" } },
      steps: [
        { id: "alpha", command: "makeDirectory", params: { filePath: "@root" } },
        { command: "makeDirectory", params: { filePath: "@root" } },
      ],
    })
    const { jobId } = await response.json() as { jobId: string }

    await flushAfter(50)

    const children = getChildJobs(jobId)
    expect(children).toHaveLength(2)
    expect(children[0].commandName).toBe("makeDirectory")
    expect(children[0].stepId).toBe("alpha")
    // assignedCounter increments only for unnamed steps. The first step
    // had an explicit id ("alpha") and didn't consume a slot, so the
    // second (unnamed) step is the first auto-assigned id.
    expect(children[1].stepId).toBe("step1")
    expect(children.every((c) => c.parentJobId === jobId)).toBe(true)
    expect(children.every((c) => c.status === "completed")).toBe(true)
  })

  test("marks downstream child jobs as skipped when an earlier step fails", async () => {
    vol.fromJSON({ "/work/keep": "" })

    const response = await post("/sequences/run", {
      steps: [
        { id: "ok", command: "makeDirectory", params: { filePath: "/ok" } },
        { id: "boom", command: "deleteFolder", params: { folderPath: "/work", confirm: false } },
        { id: "downstream1", command: "makeDirectory", params: { filePath: "/down1" } },
        { id: "downstream2", command: "makeDirectory", params: { filePath: "/down2" } },
      ],
    })
    const { jobId } = await response.json() as { jobId: string }

    await flushAfter(80)

    const children = getChildJobs(jobId)
    const byStepId = Object.fromEntries(children.map((c) => [c.stepId, c]))

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
        { id: "broken", command: "makeDirectory", params: { filePath: "@missing" } },
        { id: "after", command: "makeDirectory", params: { filePath: "/never" } },
      ],
    })
    const { jobId } = await response.json() as { jobId: string }

    await flushAfter(20)

    const children = getChildJobs(jobId)
    const byStepId = Object.fromEntries(children.map((c) => [c.stepId, c]))
    expect(byStepId.broken.status).toBe("failed")
    expect(byStepId.broken.error).toMatch(/missing/i)
    expect(byStepId.after.status).toBe("skipped")
  })

  test("umbrella sequence job has parentJobId=null so it stays at the top of the Jobs UI list", async () => {
    const response = await post("/sequences/run", {
      paths: { root: { value: "/top-level-check" } },
      steps: [{ id: "only", command: "makeDirectory", params: { filePath: "@root" } }],
    })
    const { jobId } = await response.json() as { jobId: string }

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
        { command: "makeDirectory", params: { filePath: "/should-not-run" } },
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
        { id: "before", command: "makeDirectory", params: { filePath: "@root" } },
        {
          kind: "group",
          id: "innerSerial",
          label: "Two serial steps",
          steps: [
            { id: "g1", command: "makeDirectory", params: { filePath: "@root" } },
            { id: "g2", command: "makeDirectory", params: { filePath: "@root" } },
          ],
        },
        { id: "after", command: "makeDirectory", params: { filePath: "@root" } },
      ],
    })
    expect(response.status).toBe(202)
    const { jobId } = await response.json() as { jobId: string }
    await flushAfter(80)

    const umbrella = getJob(jobId)
    expect(umbrella?.status).toBe("completed")

    // One child job per actual step — the group itself doesn't get a
    // child job; its identity lives only in the source YAML.
    const children = getChildJobs(jobId)
    expect(children.map((c) => c.stepId)).toEqual(["before", "g1", "g2", "after"])
    expect(children.every((c) => c.parentJobId === jobId)).toBe(true)
    expect(children.every((c) => c.status === "completed")).toBe(true)
  })

  test("rejects a group with no inner steps via the schema (400)", async () => {
    const response = await post("/sequences/run", {
      steps: [
        { kind: "group", steps: [] },
      ],
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
        "      filePath: /a",
        "  - kind: group",
        "    steps:",
        "      - id: same",
        "        command: makeDirectory",
        "        params:",
        "          filePath: /b",
      ].join("\n"),
    })
    expect(response.status).toBe(400)
    const body = await response.json() as { error: string }
    expect(body.error.toLowerCase()).toContain("duplicate step id")
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
        "          filePath: /alpha",
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
    const body = await response.json() as { error: string }
    expect(body.error.toLowerCase()).toContain("parallel group")
  })

  test("serial group: inner steps run in document order and group failure cascades to outer remainder", async () => {
    vol.fromJSON({ "/work/keep": "" })

    const response = await post("/sequences/run", {
      steps: [
        {
          kind: "group",
          id: "boomGroup",
          steps: [
            { id: "innerOk", command: "makeDirectory", params: { filePath: "/inner-ok" } },
            { id: "innerBoom", command: "deleteFolder", params: { folderPath: "/work", confirm: false } },
            { id: "innerSkip", command: "makeDirectory", params: { filePath: "/inner-skip" } },
          ],
        },
        { id: "afterGroup", command: "makeDirectory", params: { filePath: "/after-group" } },
      ],
    })
    const { jobId } = await response.json() as { jobId: string }
    await flushAfter(80)

    const children = getChildJobs(jobId)
    const byStepId = Object.fromEntries(children.map((c) => [c.stepId, c]))

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
            { id: "copyA", command: "copyFiles", params: { sourcePath: "/src-a", destinationPath: "/dst-a" } },
            { id: "copyB", command: "copyFiles", params: { sourcePath: "/src-b", destinationPath: "/dst-b" } },
          ],
        },
        {
          id: "consume",
          command: "copyFiles",
          params: {
            sourcePath: "/src-after",
            destinationPath: { linkedTo: "copyA", output: "folder" },
          },
        },
      ],
    })
    const { jobId } = await response.json() as { jobId: string }
    await flushAfter(150)

    const job = getJob(jobId)
    expect(job?.status).toBe("completed")
    expect(job?.error).toBeNull()

    const children = getChildJobs(jobId)
    const byStepId = Object.fromEntries(children.map((c) => [c.stepId, c]))
    expect(byStepId.copyA.status).toBe("completed")
    expect(byStepId.copyB.status).toBe("completed")
    expect(byStepId.consume.status).toBe("completed")

    // Both parallel inner copies happened, and the after-group step
    // copied /src-after/follow-up.txt into /dst-a (the folder output
    // it linked to) — that one file is the proof that the linkedTo
    // resolved through to the inner step's destination.
    expect(vol.existsSync("/dst-a/alpha.txt")).toBe(true)
    expect(vol.existsSync("/dst-b/beta.txt")).toBe(true)
    expect(vol.existsSync("/dst-a/follow-up.txt")).toBe(true)
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
            { id: "innerSuccess", command: "makeDirectory", params: { filePath: "/inner-success" } },
            { id: "innerBoom", command: "deleteFolder", params: { folderPath: "/work", confirm: false } },
          ],
        },
        { id: "afterGroup", command: "makeDirectory", params: { filePath: "/after-group" } },
      ],
    })
    const { jobId } = await response.json() as { jobId: string }
    await flushAfter(80)

    const children = getChildJobs(jobId)
    const byStepId = Object.fromEntries(children.map((c) => [c.stepId, c]))

    expect(byStepId.innerSuccess.status).toBe("completed")
    expect(byStepId.innerBoom.status).toBe("failed")
    expect(byStepId.afterGroup.status).toBe("skipped")
    expect(getJob(jobId)?.status).toBe("failed")
    expect(vol.existsSync("/after-group")).toBe(false)
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
    for (let i = 0; i < 8; i += 1) {
      seedFiles[`/par-src-a/file${i}.txt`] = "alpha-".repeat(100) + i
      seedFiles[`/par-src-b/file${i}.txt`] = "beta-".repeat(100) + i
    }
    vol.fromJSON(seedFiles)

    const response = await post("/sequences/run", {
      steps: [{
        kind: "group",
        id: "para",
        isParallel: true,
        steps: [
          { id: "concA", command: "copyFiles", params: { sourcePath: "/par-src-a", destinationPath: "/par-dst-a" } },
          { id: "concB", command: "copyFiles", params: { sourcePath: "/par-src-b", destinationPath: "/par-dst-b" } },
        ],
      }],
    })
    const { jobId } = await response.json() as { jobId: string }
    await flushAfter(150)

    expect(getJob(jobId)?.status).toBe("completed")

    const children = getChildJobs(jobId)
    const a = children.find((c) => c.stepId === "concA")
    const b = children.find((c) => c.stepId === "concB")
    expect(a?.status).toBe("completed")
    expect(b?.status).toBe("completed")
    const aStart = a?.startedAt?.getTime()
    const aEnd = a?.completedAt?.getTime()
    const bStart = b?.startedAt?.getTime()
    const bEnd = b?.completedAt?.getTime()
    expect(typeof aStart).toBe("number")
    expect(typeof aEnd).toBe("number")
    expect(typeof bStart).toBe("number")
    expect(typeof bEnd).toBe("number")

    // Lifetimes overlap: each step started before the other completed.
    // This is the proof of concurrent execution — serial would have
    // bStart > aEnd (or vice versa), violating one of these.
    expect(bStart!).toBeLessThan(aEnd!)
    expect(aStart!).toBeLessThan(bEnd!)
  })

  test("isCollapsed on a step parses without affecting runtime", async () => {
    // isCollapsed is pure view state. It must not perturb either the
    // child-job creation pass or the runtime — a sequence with a
    // collapsed step still runs that step end-to-end.
    vol.fromJSON({})
    const response = await post("/sequences/run", {
      steps: [
        { id: "collapsed", command: "makeDirectory", params: { filePath: "/collapsed-runs" }, isCollapsed: true },
      ],
    })
    expect(response.status).toBe(202)
    const { jobId } = await response.json() as { jobId: string }
    await flushAfter(40)
    expect(getJob(jobId)?.status).toBe("completed")
    expect(vol.existsSync("/collapsed-runs")).toBe(true)
  })
})
