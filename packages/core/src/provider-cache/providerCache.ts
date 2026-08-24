import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"

import { APP_DATA_DIR } from "../tools/appPaths.js"

const millisecondsPerDay = 24 * 60 * 60 * 1000
const millisecondsPerWeek = 7 * millisecondsPerDay

export const PROVIDER_CACHE_FILE_NAME =
  "provider-cache.sqlite"

// Beside the sequence-template store, so one mounted APP_DATA_DIR holds
// every piece of server-owned state.
export const providerCacheDatabasePath = join(
  APP_DATA_DIR,
  PROVIDER_CACHE_FILE_NAME,
)

export const PROVIDER_CACHE_DEFAULT_TIME_TO_LIVE =
  millisecondsPerWeek

// Album and release metadata barely changes, so the music providers get
// weeks. DVDCompare and AniDB get days: DVDCompare edits pages, and AniDB
// wants us back rarely rather than never.
export const PROVIDER_CACHE_TIME_TO_LIVE: Record<
  string,
  number
> = {
  acoustId: 4 * millisecondsPerWeek,
  aniDb: 3 * millisecondsPerDay,
  coverArtArchive: 8 * millisecondsPerWeek,
  dvdCompare: 7 * millisecondsPerDay,
  movieDb: 2 * millisecondsPerWeek,
  musicBrainz: 4 * millisecondsPerWeek,
  vgmdb: 4 * millisecondsPerWeek,
}

export type ProviderCacheRow = {
  body: string
  etag: string | null
  fetchedAt: number
}

export type ProviderCacheKey = {
  provider: string
  requestKey: string
}

export type ProviderCache = {
  clear: () => void
  close: () => void
  deleteProvider: (provider: string) => void
  get: (key: ProviderCacheKey) => ProviderCacheRow | null
  getStale: (
    key: ProviderCacheKey,
  ) => ProviderCacheRow | null
  isAvailable: boolean
  set: (
    props: ProviderCacheKey & {
      body: string
      etag?: string | null
    },
  ) => void
}

const createTableStatement = `
  CREATE TABLE IF NOT EXISTS providerCacheEntries (
    provider TEXT NOT NULL,
    requestKey TEXT NOT NULL,
    body TEXT NOT NULL,
    etag TEXT,
    fetchedAt INTEGER NOT NULL,
    PRIMARY KEY (provider, requestKey)
  )
`

const selectStatement = `
  SELECT body, etag, fetchedAt
  FROM providerCacheEntries
  WHERE provider = ? AND requestKey = ?
`

const upsertStatement = `
  INSERT INTO providerCacheEntries
    (provider, requestKey, body, etag, fetchedAt)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT (provider, requestKey) DO UPDATE SET
    body = excluded.body,
    etag = excluded.etag,
    fetchedAt = excluded.fetchedAt
`

const deleteProviderStatement = `
  DELETE FROM providerCacheEntries WHERE provider = ?
`

const deleteEverythingStatement = `
  DELETE FROM providerCacheEntries
`

type AttemptOutcome<Value> = {
  thrownError: unknown
  value: Value | null
}

const captureOutcome = <Value>({
  operation,
  outcome,
}: {
  operation: () => Value
  outcome: AttemptOutcome<Value>
}) => {
  try {
    outcome.value = operation()
  } catch (thrownError) {
    outcome.thrownError = thrownError
  }
}

const attempt = <Value>(operation: () => Value) =>
  ((outcome: AttemptOutcome<Value>) =>
    captureOutcome({ operation, outcome }) ?? outcome)({
    thrownError: null,
    value: null,
  })

type FailureHolder = {
  isFirstLogPending: boolean
}

const logFailureOnce = ({
  databasePath,
  failureHolder,
  thrownError,
}: {
  databasePath: string
  failureHolder: FailureHolder
  thrownError: unknown
}) => {
  if (failureHolder.isFirstLogPending) {
    Object.assign(failureHolder, {
      isFirstLogPending: false,
    })
    console.error(
      `Provider cache at ${databasePath} is unavailable — every request bypasses the cache.`,
      thrownError,
    )
  }
}

const attemptQuietly = <Value>({
  databasePath,
  failureHolder,
  operation,
}: {
  databasePath: string
  failureHolder: FailureHolder
  operation: () => Value
}) =>
  ((outcome: AttemptOutcome<Value>) =>
    outcome.thrownError === null
      ? outcome.value
      : (logFailureOnce({
          databasePath,
          failureHolder,
          thrownError: outcome.thrownError,
        }) ?? null))(attempt(operation))

const configureDatabase = (database: DatabaseSync) => {
  database.exec("PRAGMA journal_mode = WAL")
  database.exec(createTableStatement)
}

const createConfiguredDatabase = (databasePath: string) =>
  ((database: DatabaseSync) =>
    configureDatabase(database) ?? database)(
    new DatabaseSync(databasePath),
  )

const toProviderCacheRow = (
  row: Record<string, unknown>,
) => ({
  body: String(row.body ?? ""),
  etag: typeof row.etag === "string" ? row.etag : null,
  fetchedAt: Number(row.fetchedAt ?? 0),
})

const resolveTimeToLive = ({
  provider,
  timeToLiveByProvider,
}: {
  provider: string
  timeToLiveByProvider: Record<string, number>
}) =>
  timeToLiveByProvider[provider] ??
  PROVIDER_CACHE_DEFAULT_TIME_TO_LIVE

const isRowFresh = ({
  provider,
  row,
  timeToLiveByProvider,
}: {
  provider: string
  row: ProviderCacheRow
  timeToLiveByProvider: Record<string, number>
}) =>
  Date.now() - row.fetchedAt <
  resolveTimeToLive({ provider, timeToLiveByProvider })

const createUnavailableProviderCache = ({
  databasePath,
  thrownError,
}: {
  databasePath: string
  thrownError: unknown
}): ProviderCache =>
  ((failureHolder: FailureHolder) =>
    logFailureOnce({
      databasePath,
      failureHolder,
      thrownError,
    }) ?? {
      clear: () => {},
      close: () => {},
      deleteProvider: () => {},
      get: () => null,
      getStale: () => null,
      isAvailable: false,
      set: () => {},
    })({ isFirstLogPending: true })

const readRow = ({
  database,
  databasePath,
  failureHolder,
  provider,
  requestKey,
}: {
  database: DatabaseSync
  databasePath: string
  failureHolder: FailureHolder
  provider: string
  requestKey: string
}) =>
  ((row: Record<string, unknown> | null | undefined) =>
    row === null || row === undefined
      ? null
      : toProviderCacheRow(row))(
    attemptQuietly({
      databasePath,
      failureHolder,
      operation: () =>
        database
          .prepare(selectStatement)
          .get(provider, requestKey) as
          | Record<string, unknown>
          | undefined,
    }),
  )

const createAvailableProviderCache = ({
  database,
  databasePath,
  timeToLiveByProvider,
}: {
  database: DatabaseSync
  databasePath: string
  timeToLiveByProvider: Record<string, number>
}): ProviderCache =>
  ((failureHolder: FailureHolder) => ({
    clear: () => {
      attemptQuietly({
        databasePath,
        failureHolder,
        operation: () => {
          database.exec(deleteEverythingStatement)
        },
      })
    },
    close: () => {
      attemptQuietly({
        databasePath,
        failureHolder,
        operation: () => {
          database.close()
        },
      })
    },
    deleteProvider: (provider: string) => {
      attemptQuietly({
        databasePath,
        failureHolder,
        operation: () => {
          database
            .prepare(deleteProviderStatement)
            .run(provider)
        },
      })
    },
    get: ({ provider, requestKey }: ProviderCacheKey) =>
      ((row: ProviderCacheRow | null) =>
        row !== null &&
        isRowFresh({ provider, row, timeToLiveByProvider })
          ? row
          : null)(
        readRow({
          database,
          databasePath,
          failureHolder,
          provider,
          requestKey,
        }),
      ),
    getStale: ({
      provider,
      requestKey,
    }: ProviderCacheKey) =>
      readRow({
        database,
        databasePath,
        failureHolder,
        provider,
        requestKey,
      }),
    isAvailable: true,
    set: ({
      body,
      etag = null,
      provider,
      requestKey,
    }: ProviderCacheKey & {
      body: string
      etag?: string | null
    }) => {
      attemptQuietly({
        databasePath,
        failureHolder,
        operation: () => {
          database
            .prepare(upsertStatement)
            .run(
              provider,
              requestKey,
              body,
              etag,
              Date.now(),
            )
        },
      })
    },
  }))({ isFirstLogPending: true })

export const openProviderCache = ({
  databasePath = providerCacheDatabasePath,
  timeToLiveByProvider = PROVIDER_CACHE_TIME_TO_LIVE,
}: {
  databasePath?: string
  timeToLiveByProvider?: Record<string, number>
} = {}) =>
  ((outcome: AttemptOutcome<DatabaseSync>) =>
    outcome.value === null
      ? createUnavailableProviderCache({
          databasePath,
          thrownError: outcome.thrownError,
        })
      : createAvailableProviderCache({
          database: outcome.value,
          databasePath,
          timeToLiveByProvider,
        }))(
    attempt(() => createConfiguredDatabase(databasePath)),
  )
