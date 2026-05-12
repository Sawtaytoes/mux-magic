import { vol } from "memfs"
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
} from "vitest"
import { getJob, resetStore } from "../jobStore.js"
import {
  installLogCapture,
  uninstallLogCapture,
} from "../logCapture.js"
import { commandRoutes } from "./commandRoutes.js"

// ─── L3 server-side guard for /commands/:name dry-run safety ────────────────
//
// runOrStopStepAtom (single-step Run button) now posts to
// /commands/:name instead of /sequences/run (B4 fix). The dry-run
// query forwarding from P0 (`?fake=success` / `?fake=failure`)
// must also disable real command execution at THIS endpoint, not
// only at /sequences/run.
//
// If any future change makes /commands/:name skip isFakeRequest,
// the deleteFolder-stays-intact assertions below fail — i.e. the
// test is the canonical "real files are protected" contract.

const post = (path: string, body: unknown) =>
  commandRoutes.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

const flushAfter = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

const waitFor = async <T>(
  get: () => T | undefined,
  timeoutMs = 3000,
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

beforeAll(() => {
  installLogCapture()
})

afterAll(() => {
  uninstallLogCapture()
})

afterEach(() => {
  resetStore()
})

describe("POST /commands/:name — dry-run safety", () => {
  test("deleteFolder via ?fake=success leaves the target folder intact", async () => {
    vol.fromJSON({
      "/precious-cmd/keep-me.txt": "irreplaceable",
      "/precious-cmd/nested/also-keep-me.bin":
        "also-irreplaceable",
    })

    const response = await post(
      "/commands/deleteFolder?fake=success",
      {
        folderPath: "/precious-cmd",
        confirm: true,
      },
    )
    expect(response.status).toBe(202)
    const { jobId } = (await response.json()) as {
      jobId: string
    }

    await waitFor(() => {
      const status = getJob(jobId)?.status
      return status === "completed" || status === "failed"
        ? status
        : undefined
    })

    expect(getJob(jobId)?.status).toBe("completed")
    // The folder MUST still exist. Failure here = dry-run is broken.
    expect(vol.existsSync("/precious-cmd")).toBe(true)
    expect(
      vol.existsSync("/precious-cmd/keep-me.txt"),
    ).toBe(true)
    expect(
      vol.existsSync(
        "/precious-cmd/nested/also-keep-me.bin",
      ),
    ).toBe(true)
  })

  test("deleteFolder via ?fake=failure leaves the target folder intact (job fails as scripted)", async () => {
    vol.fromJSON({
      "/precious-cmd-failure/keep-me.txt":
        "irreplaceable-failure",
    })

    const response = await post(
      "/commands/deleteFolder?fake=failure",
      {
        folderPath: "/precious-cmd-failure",
        confirm: true,
      },
    )
    expect(response.status).toBe(202)
    const { jobId } = (await response.json()) as {
      jobId: string
    }

    await waitFor(() => {
      const status = getJob(jobId)?.status
      return status === "completed" || status === "failed"
        ? status
        : undefined
    })

    expect(getJob(jobId)?.status).toBe("failed")
    // The folder MUST still exist even in failure mode — the fake
    // observable never calls rm.
    expect(vol.existsSync("/precious-cmd-failure")).toBe(
      true,
    )
    expect(
      vol.existsSync("/precious-cmd-failure/keep-me.txt"),
    ).toBe(true)
  })

  // CONTROL: prove the test fixture would otherwise delete — i.e.
  // a dry-run regression would actually be caught.
  test("CONTROL: deleteFolder WITHOUT ?fake actually deletes the folder", async () => {
    vol.fromJSON({
      "/control-cmd-doomed/keep-me.txt": "this will go",
    })

    const response = await post("/commands/deleteFolder", {
      folderPath: "/control-cmd-doomed",
      confirm: true,
    })
    expect(response.status).toBe(202)
    const { jobId } = (await response.json()) as {
      jobId: string
    }
    await flushAfter(40)

    expect(getJob(jobId)?.status).toBe("completed")
    expect(vol.existsSync("/control-cmd-doomed")).toBe(
      false,
    )
  })
})
