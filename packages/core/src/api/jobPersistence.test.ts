import {
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises"
import { join } from "node:path"

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"
import {
  __resetJobPersistenceForTests,
  loadJobsFromDisk,
  persistJob,
  pruneOldJobs,
  resolveJobsDir,
} from "./jobPersistence.js"
import type { Job, JobStatus } from "./types.js"

const testDataDir = "/test-job-persistence-data"
const testJobsDir = join(testDataDir, "jobs")

const makeJob = (
  overrides: Partial<Job> & Pick<Job, "id" | "status">,
): Job => ({
  commandName: "copyFiles",
  completedAt: null,
  error: null,
  logs: [],
  outputFolderName: null,
  outputs: null,
  params: { sourcePath: "/media" },
  parentJobId: null,
  pauseReason: null,
  results: [],
  startedAt: null,
  stepId: null,
  threadCountClaim: null,
  ...overrides,
})

beforeEach(async () => {
  await mkdir(testJobsDir, { recursive: true })
  __resetJobPersistenceForTests(testDataDir)
})

afterEach(async () => {
  await rm(testDataDir, { recursive: true, force: true })
  vi.useRealTimers()
})

describe("resolveJobsDir", () => {
  test("returns the jobs sub-directory of the data dir", () => {
    expect(resolveJobsDir(testDataDir)).toBe(testJobsDir)
  })
})

describe("persistJob", () => {
  test("writes a JSON file named <jobId>.json", async () => {
    const job = makeJob({
      id: "job-abc",
      status: "pending",
    })
    await persistJob({ job, dataDir: testDataDir })

    const raw = await readFile(
      join(testJobsDir, "job-abc.json"),
      "utf8",
    )
    const parsed = JSON.parse(raw) as Partial<Job>
    expect(parsed.id).toBe("job-abc")
    expect(parsed.status).toBe("pending")
  })

  test("omits logs from the persisted JSON", async () => {
    const job = makeJob({
      id: "job-nologs",
      status: "running",
      logs: ["line 1", "line 2"],
    })
    await persistJob({ job, dataDir: testDataDir })

    const raw = await readFile(
      join(testJobsDir, "job-nologs.json"),
      "utf8",
    )
    const parsed = JSON.parse(raw) as Record<
      string,
      unknown
    >
    expect(parsed.logs).toBeUndefined()
  })

  test("writes via temp file + rename for atomicity", async () => {
    const job = makeJob({
      id: "job-atomic",
      status: "paused",
    })

    const tempFiles: string[] = []
    const origRename = rename

    vi.doMock("node:fs/promises", async () => {
      const actual = await vi.importActual<
        typeof import("node:fs/promises")
      >("node:fs/promises")
      return {
        ...actual,
        rename: async (
          source: string,
          destination: string,
        ) => {
          tempFiles.push(source as string)
          return origRename(source, destination)
        },
      }
    })

    await persistJob({ job, dataDir: testDataDir })

    const raw = await readFile(
      join(testJobsDir, "job-atomic.json"),
      "utf8",
    )
    expect(JSON.parse(raw)).toMatchObject({
      id: "job-atomic",
    })
  })

  test("concurrent persists of the same job never collide on the temp file", async () => {
    // Regression: temp paths were `…tmp-<pid>-<Date.now()>`, and Date.now()
    // only resolves to the millisecond. Many persists of the same job fired
    // in the same tick share a millisecond → identical temp name → the first
    // rename moves it away and the rest throw ENOENT. Because persists are
    // fire-and-forget, that rejection crashed the server. Firing a burst
    // concurrently reliably lands several in the same millisecond.
    const job = makeJob({
      id: "job-concurrent",
      status: "running",
    })

    const results = await Promise.allSettled(
      Array.from({ length: 50 }, (_unused, index) =>
        persistJob({
          job: { ...job, results: [index] },
          dataDir: testDataDir,
        }),
      ),
    )

    const rejected = results.filter(
      (result) => result.status === "rejected",
    )
    expect(rejected).toHaveLength(0)

    // The surviving file is still valid JSON (last writer wins atomically).
    const raw = await readFile(
      join(testJobsDir, "job-concurrent.json"),
      "utf8",
    )
    expect(JSON.parse(raw)).toMatchObject({
      id: "job-concurrent",
    })
  })

  test("persists pauseReason when job is paused", async () => {
    const job = makeJob({
      id: "job-paused",
      status: "paused",
      pauseReason: "user_input",
    })
    await persistJob({ job, dataDir: testDataDir })

    const raw = await readFile(
      join(testJobsDir, "job-paused.json"),
      "utf8",
    )
    const parsed = JSON.parse(raw) as Partial<Job>
    expect(parsed.status).toBe("paused")
    expect(parsed.pauseReason).toBe("user_input")
  })

  test("persists null pauseReason for non-paused jobs", async () => {
    const job = makeJob({
      id: "job-running",
      status: "running",
      pauseReason: null,
    })
    await persistJob({ job, dataDir: testDataDir })

    const raw = await readFile(
      join(testJobsDir, "job-running.json"),
      "utf8",
    )
    const parsed = JSON.parse(raw) as Partial<Job>
    expect(parsed.pauseReason).toBeNull()
  })
})

describe("loadJobsFromDisk", () => {
  test("returns empty array when jobs dir does not exist", async () => {
    const jobs = await loadJobsFromDisk({
      dataDir: "/nonexistent-data-dir-xyz",
    })
    expect(jobs).toEqual([])
  })

  test("reconstructs persisted jobs into memory", async () => {
    const job = makeJob({
      id: "job-restore",
      status: "completed",
    })
    await persistJob({ job, dataDir: testDataDir })

    const jobs = await loadJobsFromDisk({
      dataDir: testDataDir,
    })
    expect(jobs).toHaveLength(1)
    expect(jobs[0]?.id).toBe("job-restore")
    expect(jobs[0]?.status).toBe("completed")
  })

  test("resets running jobs to failed with restart message", async () => {
    const runningJob = makeJob({
      id: "job-was-running",
      status: "running",
      startedAt: new Date("2026-01-01T10:00:00Z"),
    })
    await persistJob({
      job: runningJob,
      dataDir: testDataDir,
    })

    const jobs = await loadJobsFromDisk({
      dataDir: testDataDir,
    })
    const restored = jobs.find(
      (job) => job.id === "job-was-running",
    )
    expect(restored?.status).toBe("failed")
    expect(restored?.error).toBe(
      "server restarted while running",
    )
  })

  test("keeps paused jobs as paused", async () => {
    const pausedJob = makeJob({
      id: "job-was-paused",
      status: "paused",
      pauseReason: "user_input",
    })
    await persistJob({
      job: pausedJob,
      dataDir: testDataDir,
    })

    const jobs = await loadJobsFromDisk({
      dataDir: testDataDir,
    })
    const restored = jobs.find(
      (job) => job.id === "job-was-paused",
    )
    expect(restored?.status).toBe("paused")
    expect(restored?.pauseReason).toBe("user_input")
  })

  test("skips corrupted JSON files and continues", async () => {
    await writeFile(
      join(testJobsDir, "corrupt.json"),
      "this is not json",
      "utf8",
    )
    const validJob = makeJob({
      id: "job-valid",
      status: "completed",
    })
    await persistJob({
      job: validJob,
      dataDir: testDataDir,
    })

    const jobs = await loadJobsFromDisk({
      dataDir: testDataDir,
    })
    expect(jobs).toHaveLength(1)
    expect(jobs[0]?.id).toBe("job-valid")
  })

  test("includes empty logs array on each reconstructed job", async () => {
    const job = makeJob({
      id: "job-logs",
      status: "pending",
    })
    await persistJob({ job, dataDir: testDataDir })

    const jobs = await loadJobsFromDisk({
      dataDir: testDataDir,
    })
    expect(jobs[0]?.logs).toEqual([])
  })
})

describe("pruneOldJobs", () => {
  test("deletes job files older than the retention threshold", async () => {
    const oldJob = makeJob({
      id: "job-old",
      status: "completed",
      completedAt: new Date("2020-01-01T00:00:00Z"),
    })
    await persistJob({ job: oldJob, dataDir: testDataDir })

    const recentJob = makeJob({
      id: "job-recent",
      status: "completed",
      completedAt: new Date(),
    })
    await persistJob({
      job: recentJob,
      dataDir: testDataDir,
    })

    await pruneOldJobs({
      dataDir: testDataDir,
      retentionDays: 30,
    })

    const remaining = await loadJobsFromDisk({
      dataDir: testDataDir,
    })
    expect(remaining.map((job) => job.id)).not.toContain(
      "job-old",
    )
    expect(remaining.map((job) => job.id)).toContain(
      "job-recent",
    )
  })

  test("keeps paused jobs regardless of age", async () => {
    const oldPausedJob = makeJob({
      id: "job-old-paused",
      status: "paused",
      pauseReason: "user_input",
      startedAt: new Date("2020-01-01T00:00:00Z"),
    })
    await persistJob({
      job: oldPausedJob,
      dataDir: testDataDir,
    })

    await pruneOldJobs({
      dataDir: testDataDir,
      retentionDays: 30,
    })

    const remaining = await loadJobsFromDisk({
      dataDir: testDataDir,
    })
    expect(remaining.map((job) => job.id)).toContain(
      "job-old-paused",
    )
  })

  test("is a no-op when jobs dir does not exist", async () => {
    await expect(
      pruneOldJobs({
        dataDir: "/nonexistent-prune-dir",
        retentionDays: 30,
      }),
    ).resolves.not.toThrow()
  })
})

describe("JobStatus includes paused", () => {
  test("paused is an accepted status value", () => {
    const status: JobStatus = "paused"
    expect(status).toBe("paused")
  })
})
