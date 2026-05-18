import {
  mkdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises"
import { dirname } from "node:path"

import type {
  PersistedJobError,
  WebhookDeliveryState,
} from "./jobErrorDeliveryStateMachine.js"
import { resolveJobErrorsFilePath } from "./jobErrorStorePath.js"

export type { PersistedJobError } from "./jobErrorDeliveryStateMachine.js"

export const ERROR_STORE_CAP = 1000

const FILE_VERSION = 1

type JobErrorsFile = {
  version: 1
  errors: PersistedJobError[]
}

const compareOccurredAtAsc = (
  left: PersistedJobError,
  right: PersistedJobError,
): number => {
  if (left.occurredAt === right.occurredAt) return 0
  return left.occurredAt < right.occurredAt ? -1 : 1
}

const filterByState = (
  errors: readonly PersistedJobError[],
  state: WebhookDeliveryState,
): PersistedJobError[] =>
  errors.filter(
    (record) => record.webhookDelivery.state === state,
  )

// Pure eviction policy: keeps every `pending` record, then drops
// oldest-by-`occurredAt` records that are `delivered` first, then
// `exhausted`, until the total is at most `cap`.
export const applyEvictionPolicy = (
  errors: readonly PersistedJobError[],
  cap: number,
): PersistedJobError[] => {
  if (errors.length <= cap) return errors.slice()

  const pendings = filterByState(errors, "pending")
  const delivereds = filterByState(
    errors,
    "delivered",
  ).sort(compareOccurredAtAsc)
  const exhausteds = filterByState(
    errors,
    "exhausted",
  ).sort(compareOccurredAtAsc)

  const overBy = errors.length - cap

  const droppedDelivered = Math.min(
    overBy,
    delivereds.length,
  )
  const droppedExhausted = Math.min(
    overBy - droppedDelivered,
    exhausteds.length,
  )

  const keptDelivered = delivereds.slice(droppedDelivered)
  const keptExhausted = exhausteds.slice(droppedExhausted)

  const keptIds = new Set<string>([
    ...pendings.map(({ id }) => id),
    ...keptDelivered.map(({ id }) => id),
    ...keptExhausted.map(({ id }) => id),
  ])

  return errors.filter(({ id }) => keptIds.has(id))
}

type WriteQueue = Promise<void>

type StoreState = {
  filePath: string
  errors: PersistedJobError[]
  isLoaded: boolean
  writeQueue: WriteQueue
}

const createInitialState = (
  filePath?: string,
): StoreState => ({
  errors: [],
  filePath: filePath ?? resolveJobErrorsFilePath(),
  isLoaded: false,
  writeQueue: Promise.resolve(),
})

let state: StoreState = createInitialState()

export const __resetJobErrorStoreForTests = (
  filePath?: string,
): void => {
  state = createInitialState(filePath)
}

const parseFile = (raw: string): PersistedJobError[] => {
  try {
    const parsed = JSON.parse(raw) as Partial<JobErrorsFile>
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      parsed.version !== FILE_VERSION ||
      !Array.isArray(parsed.errors)
    ) {
      return []
    }
    return parsed.errors as PersistedJobError[]
  } catch {
    return []
  }
}

export const loadJobErrorsFromDisk =
  async (): Promise<void> => {
    try {
      const raw = await readFile(state.filePath, "utf8")
      state = {
        ...state,
        errors: parseFile(raw),
        isLoaded: true,
      }
    } catch (error: unknown) {
      if (
        (error as NodeJS.ErrnoException).code === "ENOENT"
      ) {
        state = { ...state, errors: [], isLoaded: true }
        return
      }
      state = { ...state, errors: [], isLoaded: true }
    }
  }

const ensureLoaded = async (): Promise<void> => {
  if (state.isLoaded) return
  await loadJobErrorsFromDisk()
}

const writeAtomic = async (
  filePath: string,
  payload: JobErrorsFile,
): Promise<void> => {
  await mkdir(dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`
  await writeFile(
    tempPath,
    JSON.stringify(payload, null, 2),
    "utf8",
  )
  await rename(tempPath, filePath)
}

// Serializes writes through `state.writeQueue` so concurrent calls
// don't race on the in-memory `errors` array or the on-disk file.
const enqueueWrite = (
  mutator: (
    current: readonly PersistedJobError[],
  ) => readonly PersistedJobError[],
): Promise<void> => {
  const next = state.writeQueue.then(async () => {
    await ensureLoaded()
    const mutated = mutator(state.errors)
    const evicted = applyEvictionPolicy(
      mutated,
      ERROR_STORE_CAP,
    )
    state = {
      ...state,
      errors: evicted.slice(),
    }
    await writeAtomic(state.filePath, {
      errors: state.errors,
      version: FILE_VERSION,
    })
  })
  state = {
    ...state,
    writeQueue: next.catch(() => undefined),
  }
  return next
}

export const addJobError = (
  record: PersistedJobError,
): Promise<void> =>
  enqueueWrite((current) => current.concat(record))

export const updateJobError = (
  id: string,
  mutator: (record: PersistedJobError) => PersistedJobError,
): Promise<void> =>
  enqueueWrite((current) =>
    current.map((record) =>
      record.id === id ? mutator(record) : record,
    ),
  )

export const deleteJobError = (id: string): Promise<void> =>
  enqueueWrite((current) =>
    current.filter((record) => record.id !== id),
  )

export const getJobError = (
  id: string,
): PersistedJobError | undefined =>
  state.errors.find((record) => record.id === id)

export type ListJobErrorsFilter = {
  state?: WebhookDeliveryState
  jobId?: string
}

const compareOccurredAtDesc = (
  left: PersistedJobError,
  right: PersistedJobError,
): number => compareOccurredAtAsc(right, left)

export const listJobErrors = (
  filter: ListJobErrorsFilter,
): PersistedJobError[] => {
  const stateFilter = filter.state
  const jobIdFilter = filter.jobId
  return state.errors
    .filter((record) => {
      const isStateMatch =
        stateFilter === undefined ||
        record.webhookDelivery.state === stateFilter
      const isJobIdMatch =
        jobIdFilter === undefined ||
        record.jobId === jobIdFilter
      return isStateMatch && isJobIdMatch
    })
    .slice()
    .sort(compareOccurredAtDesc)
}
