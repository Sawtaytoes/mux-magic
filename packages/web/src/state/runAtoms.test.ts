import { createStore } from "jotai"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"
import { apiBase } from "../apiBase"
import { COMMANDS } from "../commands/commands"
import { sequenceRunModalAtom } from "../components/SequenceRunModal/sequenceRunModalAtom"
import {
  dryRunAtom,
  failureModeAtom,
} from "../state/dryRunQuery"
import {
  runningAtom,
  runOrStopStepAtom,
} from "../state/runAtoms"
import { setStepRunStatusAtom } from "../state/stepAtoms"
import type { Step } from "../types"
import { commandsAtom } from "./commandsAtom"
import { pathsAtom } from "./pathsAtom"
import { stepsAtom } from "./stepsAtom"

const makeStep = (overrides: Partial<Step> = {}): Step => ({
  id: "step_1",
  alias: "",
  command: "ffmpegTranscode",
  params: {},
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
  ...overrides,
})

const makeStore = (step: Step) => {
  const store = createStore()
  store.set(stepsAtom, [step])
  store.set(pathsAtom, [
    {
      id: "basePath",
      label: "basePath",
      value: "/media",
      type: "path" as const,
    },
  ])
  store.set(commandsAtom, COMMANDS)
  return store
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("runOrStopStepAtom", () => {
  describe("cancel branch", () => {
    beforeEach(() => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: true }),
      )
    })

    test("DELETEs job when step is running with jobId", async () => {
      const step = makeStep({
        status: "running",
        jobId: "job_abc",
      })
      const store = makeStore(step)

      await store.set(runOrStopStepAtom, "step_1")

      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        `${apiBase}/jobs/job_abc`,
        { method: "DELETE" },
      )
    })

    test("does not open SequenceRunModal when cancelling", async () => {
      const step = makeStep({
        status: "running",
        jobId: "job_abc",
      })
      const store = makeStore(step)

      await store.set(runOrStopStepAtom, "step_1")

      expect(store.get(sequenceRunModalAtom).mode).toBe(
        "closed",
      )
    })
  })

  describe("run branch", () => {
    beforeEach(() => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ jobId: "job_new" }),
        }),
      )
      // Stub EventSource globally — jsdom doesn't provide it. Tests
      // that need to control SSE behaviour replace this stub inline.
      vi.stubGlobal(
        "EventSource",
        class {
          static CLOSED = 2
          readyState = 1
          onmessage: unknown = null
          onerror: unknown = null
          close() {}
        },
      )
    })

    test("POSTs to /commands/:name (NOT /sequences/run) when step is idle — B4 fix", async () => {
      const step = makeStep()
      const store = makeStore(step)

      await store.set(runOrStopStepAtom, "step_1")

      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        `${apiBase}/commands/ffmpegTranscode`,
        expect.objectContaining({ method: "POST" }),
      )
      // Defensive: must NOT call /sequences/run (the old umbrella path).
      const calls = vi
        .mocked(fetch)
        .mock.calls.map((call) => call[0] as string)
      expect(
        calls.some((url) =>
          url.startsWith(`${apiBase}/sequences/run`),
        ),
      ).toBe(false)
    })

    test("does NOT open SequenceRunModal when running a step", async () => {
      const step = makeStep()
      const store = makeStore(step)

      await store.set(runOrStopStepAtom, "step_1")

      expect(store.get(sequenceRunModalAtom).mode).toBe(
        "closed",
      )
    })

    test("sets step status to 'running' and jobId inline after server responds", async () => {
      const step = makeStep()
      const store = makeStore(step)

      await store.set(runOrStopStepAtom, "step_1")

      const updated = store.get(stepsAtom)[0] as Step
      expect(updated.status).toBe("running")
      expect(updated.jobId).toBe("job_new")
    })

    test("does NOT open its own SSE connection — StepRunProgress owns the single /jobs/:id/logs subscription", async () => {
      const eventSourceCtor = vi.fn()
      vi.stubGlobal("EventSource", eventSourceCtor)

      const step = makeStep()
      const store = makeStore(step)

      await store.set(runOrStopStepAtom, "step_1")

      expect(eventSourceCtor).not.toHaveBeenCalled()
    })

    test("does nothing when runningAtom is already true", async () => {
      const step = makeStep()
      const store = makeStore(step)
      store.set(runningAtom, true)

      await store.set(runOrStopStepAtom, "step_1")

      expect(vi.mocked(fetch)).not.toHaveBeenCalled()
    })

    test("does nothing when stepId not found", async () => {
      const step = makeStep()
      const store = makeStore(step)

      await store.set(runOrStopStepAtom, "nonexistent")

      expect(vi.mocked(fetch)).not.toHaveBeenCalled()
    })

    test("sets step status to 'failed' when fetch throws (no modal opened)", async () => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockRejectedValue(new Error("Network error")),
      )
      const step = makeStep()
      const store = makeStore(step)

      await store.set(runOrStopStepAtom, "step_1")

      const updated = store.get(stepsAtom)[0] as Step
      expect(updated.status).toBe("failed")
      expect(updated.error).toBe("Network error")
      expect(store.get(sequenceRunModalAtom).mode).toBe(
        "closed",
      )
      expect(store.get(runningAtom)).toBe(false)
    })

    test("surfaces server validation message on 400 response (no opaque 'failed')", async () => {
      // Mirrors the @hono/zod-openapi 400 body shape so the
      // extraction helper has something realistic to parse.
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
          json: () =>
            Promise.resolve({
              success: false,
              error: {
                name: "ZodError",
                issues: [
                  {
                    code: "invalid_type",
                    expected: "string",
                    received: "object",
                    path: ["sourcePath"],
                    message:
                      "Expected string, received object",
                  },
                ],
              },
            }),
        }),
      )
      const step = makeStep()
      const store = makeStore(step)

      await store.set(runOrStopStepAtom, "step_1")

      const updated = store.get(stepsAtom)[0] as Step
      expect(updated.status).toBe("failed")
      expect(updated.error).toBe(
        "sourcePath: Expected string, received object",
      )
      expect(store.get(runningAtom)).toBe(false)
    })

    test("falls back to 'Request failed' when 400 body is non-JSON", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
          json: () => Promise.reject(new Error("not json")),
        }),
      )
      const step = makeStep()
      const store = makeStore(step)

      await store.set(runOrStopStepAtom, "step_1")

      const updated = store.get(stepsAtom)[0] as Step
      expect(updated.status).toBe("failed")
      expect(updated.error).toBe("Request failed")
    })

    test("resolves {linkedTo, output: 'folder'} client-side using the source step's sourcePath + outputFolderName", async () => {
      // Mirrors the real-world Daemons-of-the-Shadow-Realm YAML: step1
      // extractSubtitles writes EXTRACTED-SUBTITLES under the base path,
      // step2 modifySubtitleMetadata chains its sourcePath off that
      // folder. Running step2 on its own should POST the synthesized
      // path, NOT bail out with "run the whole sequence".
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ jobId: "job_new" }),
      })
      vi.stubGlobal("fetch", fetchSpy)
      const store = createStore()
      store.set(stepsAtom, [
        makeStep({
          id: "step1",
          command: "extractSubtitles",
          params: { isRecursive: false },
          links: { sourcePath: "basePath" },
        }),
        makeStep({
          id: "step2",
          command: "modifySubtitleMetadata",
          params: { isRecursive: true, recursiveDepth: 2 },
          links: {
            sourcePath: {
              linkedTo: "step1",
              output: "folder",
            },
          },
        }),
      ])
      store.set(pathsAtom, [
        {
          id: "basePath",
          label: "Base path",
          value: "G:\\Anime\\Daemons",
          type: "path" as const,
        },
      ])
      store.set(commandsAtom, COMMANDS)

      await store.set(runOrStopStepAtom, "step2")

      expect(fetchSpy).toHaveBeenCalled()
      const fetchCall = fetchSpy.mock.calls[0]
      expect(fetchCall?.[0]).toBe(
        `${apiBase}/commands/modifySubtitleMetadata`,
      )
      const body = JSON.parse(
        (fetchCall?.[1] as RequestInit).body as string,
      )
      expect(body.sourcePath).toBe(
        "G:\\Anime\\Daemons/EXTRACTED-SUBTITLES",
      )
      const updated = store.get(
        stepsAtom,
      )[1] as Step
      expect(updated.status).toBe("running")
    })

    test("surfaces a directive error when a {linkedTo, output: <named>} reference can't be resolved client-side", async () => {
      // Named runtime outputs (e.g. modifySubtitleMetadata's `rules`)
      // genuinely require the source step to have run — single-step
      // runs can't synthesize them. Should NOT POST; should bail with a
      // message naming the field and the source step.
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ jobId: "job_new" }),
      })
      vi.stubGlobal("fetch", fetchSpy)
      const store = createStore()
      store.set(stepsAtom, [
        makeStep({
          id: "step1",
          command: "modifySubtitleMetadata",
          params: {},
          links: { sourcePath: "basePath" },
        }),
        makeStep({
          id: "step2",
          command: "modifySubtitleMetadata",
          params: {},
          links: {
            rules: {
              linkedTo: "step1",
              output: "rules",
            },
          },
        }),
      ])
      store.set(pathsAtom, [
        {
          id: "basePath",
          label: "Base path",
          value: "G:\\Anime",
          type: "path" as const,
        },
      ])
      store.set(commandsAtom, COMMANDS)

      await store.set(runOrStopStepAtom, "step2")

      expect(fetchSpy).not.toHaveBeenCalled()
      const updated = store.get(stepsAtom)[1] as Step
      expect(updated.status).toBe("failed")
      expect(updated.error).toMatch(/rules/)
      expect(updated.error).toMatch(
        /run the whole sequence/i,
      )
    })

    test("blocks single-step run pre-flight when a field still carries a linkedTo reference — fetch never called", async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ jobId: "job_new" }),
      })
      vi.stubGlobal("fetch", fetchSpy)
      const step = makeStep({
        command: "keepLanguages",
        links: {
          sourcePath: {
            linkedTo: "step5_2",
            output: "folder",
          },
        },
      })
      const store = makeStore(step)

      await store.set(runOrStopStepAtom, "step_1")

      expect(fetchSpy).not.toHaveBeenCalled()
      const updated = store.get(stepsAtom)[0] as Step
      expect(updated.status).toBe("failed")
      expect(updated.error).toMatch(
        /sourcePath is linked to step5_2/,
      )
      expect(updated.error).toMatch(
        /run the whole sequence/i,
      )
      // runningAtom must not stay true after the preflight bail.
      expect(store.get(runningAtom)).toBe(false)
    })

    test("finds step inside a group", async () => {
      const innerStep = makeStep({ id: "inner_1" })
      const store = createStore()
      store.set(stepsAtom, [
        {
          kind: "group" as const,
          id: "group_1",
          label: "My group",
          isParallel: false,
          isCollapsed: false,
          steps: [innerStep],
        },
      ])
      store.set(pathsAtom, [
        {
          id: "basePath",
          label: "basePath",
          value: "/media",
          type: "path" as const,
        },
      ])
      store.set(commandsAtom, COMMANDS)

      await store.set(runOrStopStepAtom, "inner_1")

      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        `${apiBase}/commands/ffmpegTranscode`,
        expect.objectContaining({ method: "POST" }),
      )
    })

    test("resolves @pathId references in step params before posting (B4)", async () => {
      // A step that links `sourcePath` to the `basePath` path variable
      // (value: "/media"). The server's /commands/:name endpoint takes
      // already-resolved params, so the client must expand @basePath
      // → "/media" before POSTing.
      const step = makeStep({
        command: "keepLanguages",
        links: { sourcePath: "basePath" },
      })
      const store = makeStore(step)

      await store.set(runOrStopStepAtom, "step_1")

      const fetchCall = vi.mocked(fetch).mock.calls[0]
      expect(fetchCall?.[0]).toBe(
        `${apiBase}/commands/keepLanguages`,
      )
      const body = JSON.parse(
        (fetchCall?.[1] as RequestInit).body as string,
      )
      expect(body.sourcePath).toBe("/media")
      // Must NOT leak the @pathId string through to the server.
      expect(body.sourcePath).not.toMatch(/^@/)
    })

    test("does nothing when step has no command (B4: cannot run command-less step)", async () => {
      const step = makeStep({ command: "" })
      const store = makeStore(step)

      await store.set(runOrStopStepAtom, "step_1")

      expect(vi.mocked(fetch)).not.toHaveBeenCalled()
    })
  })

  // ─── P0 regression guard: dry-run query forwarding ─────────────────────────
  //
  // Without this, every "Run Step" while the DRY RUN badge was on
  // still executed real commands on the server (the user lost real
  // files to deleteFolder). These tests fail if any future change
  // drops the dry-run forwarding from runOrStopStepAtom.
  describe("dry-run forwarding", () => {
    beforeEach(() => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ jobId: "job_new" }),
        }),
      )
      vi.stubGlobal(
        "EventSource",
        class {
          static CLOSED = 2
          readyState = 1
          onmessage: unknown = null
          onerror: unknown = null
          close() {}
        },
      )
    })

    test("posts to /commands/:name with NO fake query when dryRun is off", async () => {
      const step = makeStep()
      const store = makeStore(step)
      store.set(dryRunAtom, false)
      store.set(failureModeAtom, false)

      await store.set(runOrStopStepAtom, "step_1")

      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        `${apiBase}/commands/ffmpegTranscode`,
        expect.objectContaining({ method: "POST" }),
      )
    })

    test("posts to /commands/:name?fake=success when dryRun is on (no failureMode)", async () => {
      const step = makeStep()
      const store = makeStore(step)
      store.set(dryRunAtom, true)
      store.set(failureModeAtom, false)

      await store.set(runOrStopStepAtom, "step_1")

      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        `${apiBase}/commands/ffmpegTranscode?fake=success`,
        expect.objectContaining({ method: "POST" }),
      )
    })

    test("posts to /commands/:name?fake=failure when dryRun AND failureMode are both on", async () => {
      const step = makeStep()
      const store = makeStore(step)
      store.set(dryRunAtom, true)
      store.set(failureModeAtom, true)

      await store.set(runOrStopStepAtom, "step_1")

      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        `${apiBase}/commands/ffmpegTranscode?fake=failure`,
        expect.objectContaining({ method: "POST" }),
      )
    })

    test("ignores failureMode when dryRun is off (defensive — real call should not silently become fake)", async () => {
      const step = makeStep()
      const store = makeStore(step)
      store.set(dryRunAtom, false)
      store.set(failureModeAtom, true)

      await store.set(runOrStopStepAtom, "step_1")

      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        `${apiBase}/commands/ffmpegTranscode`,
        expect.objectContaining({ method: "POST" }),
      )
    })
  })
})

// Verify setStepRunStatusAtom still works (regression guard after imports changed)
describe("setStepRunStatusAtom", () => {
  test("updates step status in stepsAtom", () => {
    const step = makeStep({ status: null })
    const store = makeStore(step)

    store.set(setStepRunStatusAtom, {
      stepId: "step_1",
      status: "running",
      jobId: "job_1",
    })

    const steps = store.get(stepsAtom)
    expect((steps[0] as Step).status).toBe("running")
    expect((steps[0] as Step).jobId).toBe("job_1")
  })
})
