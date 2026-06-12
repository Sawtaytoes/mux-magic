import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises"
import { homedir, platform } from "node:os"
import { join } from "node:path"

import type { Job } from "./types.js"

// ---------------------------------------------------------------------------
// Platform-aware data directory resolution
// ---------------------------------------------------------------------------

const resolveAppDataDir = () => {
  const explicit = process.env.MUX_MAGIC_DATA_DIR
  if (explicit !== undefined && explicit !== "") {
    return explicit
  }

  if (platform() === "win32") {
    const appData = process.env.APPDATA
    if (appData !== undefined && appData !== "") {
      return join(appData, "mux-magic")
    }
    return join(
      homedir(),
      "AppData",
      "Roaming",
      "mux-magic",
    )
  }

  const xdg = process.env.XDG_DATA_HOME
  if (xdg !== undefined && xdg !== "") {
    return join(xdg, "mux-magic")
  }

  return join(homedir(), ".local", "share", "mux-magic")
}

// ---------------------------------------------------------------------------
// Module-level state (overrideable for tests)
// ---------------------------------------------------------------------------

let activeDataDir: string | null = null
let isDisabledForTests = false

export const __resetJobPersistenceForTests = (
  dataDir: string,
): void => {
  activeDataDir = dataDir
  isDisabledForTests = false
}

export const __disableJobPersistenceForTests = (): void => {
  isDisabledForTests = true
}

const getDataDir = () =>
  activeDataDir ?? resolveAppDataDir()

export const resolveJobsDir = (dataDir: string): string =>
  join(dataDir, "jobs")

// ---------------------------------------------------------------------------
// Serialization helpers
// ---------------------------------------------------------------------------

// The on-disk shape omits `logs` to avoid thrashing disk on every log
// append. Logs are append-only and written to a separate .log file;
// on boot the in-memory job is reconstructed with an empty `logs` array
// so callers always receive the canonical `Job` shape.
type PersistedJobRecord = Omit<
  Job,
  "logs" | "startedAt" | "completedAt"
> & {
  startedAt: string | null
  completedAt: string | null
}

const serializeJob = ({
  logs: _logs,
  startedAt,
  completedAt,
  ...rest
}: Job): PersistedJobRecord => ({
  ...rest,
  startedAt:
    startedAt instanceof Date
      ? startedAt.toISOString()
      : startedAt,
  completedAt:
    completedAt instanceof Date
      ? completedAt.toISOString()
      : completedAt,
})

const deserializeJob = (
  record: PersistedJobRecord,
): Job => ({
  ...record,
  logs: [],
  startedAt: record.startedAt
    ? new Date(record.startedAt)
    : null,
  completedAt: record.completedAt
    ? new Date(record.completedAt)
    : null,
})

// ---------------------------------------------------------------------------
// Atomic write helper
// ---------------------------------------------------------------------------

const writeAtomic = async ({
  filePath,
  content,
}: {
  filePath: string
  content: string
}): Promise<void> => {
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`
  await writeFile(tempPath, content, "utf8")
  await rename(tempPath, filePath)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const persistJob = async ({
  job,
  dataDir,
}: {
  job: Job
  dataDir?: string
}): Promise<void> => {
  if (isDisabledForTests) {
    return
  }

  const resolvedDataDir = dataDir ?? getDataDir()
  const jobsDir = resolveJobsDir(resolvedDataDir)
  await mkdir(jobsDir, { recursive: true })
  const filePath = join(jobsDir, `${job.id}.json`)
  const record = serializeJob(job)
  await writeAtomic({
    filePath,
    content: JSON.stringify(record, null, 2),
  })
}

export const loadJobsFromDisk = async ({
  dataDir,
}: {
  dataDir?: string
} = {}): Promise<Job[]> => {
  const resolvedDataDir = dataDir ?? getDataDir()
  const jobsDir = resolveJobsDir(resolvedDataDir)

  let entries: string[]
  try {
    entries = await readdir(jobsDir)
  } catch (error: unknown) {
    if (
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return []
    }
    return []
  }

  const jsonFiles = entries.filter((entry) =>
    entry.endsWith(".json"),
  )

  const jobs = await Promise.all(
    jsonFiles.map(async (fileName) => {
      const filePath = join(jobsDir, fileName)
      try {
        const raw = await readFile(filePath, "utf8")
        const record = JSON.parse(raw) as PersistedJobRecord
        const job = deserializeJob(record)

        if (job.status === "running") {
          return {
            ...job,
            status: "failed" as const,
            error: "server restarted while running",
            completedAt: new Date(),
          }
        }

        return job
      } catch {
        return null
      }
    }),
  )

  return jobs.filter((job): job is Job => job !== null)
}

// ---------------------------------------------------------------------------
// Prune helpers
// ---------------------------------------------------------------------------

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

const isJobEligibleForPrune = ({
  job,
  cutoffDate,
}: {
  job: Job
  cutoffDate: Date
}) => {
  if (job.status === "paused") {
    return false
  }

  const terminalDate = job.completedAt ?? job.startedAt
  if (terminalDate === null) {
    return false
  }

  return terminalDate < cutoffDate
}

export const pruneOldJobs = async ({
  dataDir,
  retentionDays,
}: {
  dataDir?: string
  retentionDays: number
}): Promise<void> => {
  const resolvedDataDir = dataDir ?? getDataDir()
  const jobsDir = resolveJobsDir(resolvedDataDir)

  let entries: string[]
  try {
    entries = await readdir(jobsDir)
  } catch (error: unknown) {
    if (
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return
    }
    return
  }

  const cutoffDate = new Date(
    Date.now() - retentionDays * MILLISECONDS_PER_DAY,
  )

  const jsonFiles = entries.filter((entry) =>
    entry.endsWith(".json"),
  )

  await Promise.all(
    jsonFiles.map(async (fileName) => {
      const filePath = join(jobsDir, fileName)
      try {
        const raw = await readFile(filePath, "utf8")
        const record = JSON.parse(raw) as PersistedJobRecord
        const job = deserializeJob(record)

        if (isJobEligibleForPrune({ job, cutoffDate })) {
          await rm(filePath, { force: true })
        }
      } catch {
        // Skip unreadable/corrupt files
      }
    }),
  )
}
