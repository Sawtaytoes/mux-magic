import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"

import { APP_DATA_DIR } from "../tools/appPaths.js"

const millisecondsPerDay = 24 * 60 * 60 * 1000

export const PROVIDER_CACHE_FILE_NAME =
  "provider-cache.sqlite"

// Beside the sequence-template store, so one mounted APP_DATA_DIR holds
// every piece of server-owned state.
export const providerCacheDatabasePath = join(
  APP_DATA_DIR,
  PROVIDER_CACHE_FILE_NAME,
)

export type ProviderCachePolicy = {
  // How long a stored answer is served WITHOUT asking the provider. Zero
  // means network-first: every read goes to the provider, and the stored
  // row is only the fallback for when that request fails.
  freshWindowMilliseconds: number
}

const NETWORK_FIRST: ProviderCachePolicy = {
  freshWindowMilliseconds: 0,
}

// Every provider that reads through the cache, and the one thing that
// differs between them. The owner's rule (2026-09-29): fetch the latest
// every time, and use the cache only when the provider cannot answer.
//
// AniDB is the single exception, and it is not a tuning choice: AniDB bans
// a client that requests the same anime twice in one day, so an entry
// younger than a day is served with no request at all. Past a day it is
// network-first like the rest. Do not add a window for any other provider
// without a documented ban-for-repeat rule of the same kind.
//
// `satisfies` plus the `ProviderCacheProvider` key type is the check the
// old time-to-live table lacked: `createCachedFetch` and
// `createCachedComputation` only accept a provider named here, so a
// fetcher registered under a name the table does not have fails to
// compile instead of running silently on a default.
export const PROVIDER_CACHE_POLICIES = {
  acoustId: NETWORK_FIRST,
  aniDb: { freshWindowMilliseconds: millisecondsPerDay },
  animeThemes: NETWORK_FIRST,
  coverArtArchive: NETWORK_FIRST,
  criterionForum: NETWORK_FIRST,
  discogs: NETWORK_FIRST,
  dvdCompare: NETWORK_FIRST,
  freedbCddb: NETWORK_FIRST,
  itunes: NETWORK_FIRST,
  jikan: NETWORK_FIRST,
  movieDb: NETWORK_FIRST,
  musicBrainz: NETWORK_FIRST,
  myAnimeList: NETWORK_FIRST,
  tvdb: NETWORK_FIRST,
  vgmdbCddb: NETWORK_FIRST,
} as const satisfies Record<string, ProviderCachePolicy>

export type ProviderCacheProvider =
  keyof typeof PROVIDER_CACHE_POLICIES

export const PROVIDER_CACHE_FRESH_WINDOW: Record<
  string,
  number
> = Object.fromEntries(
  Object.entries(PROVIDER_CACHE_POLICIES).map(
    ([provider, policy]) => [
      provider,
      policy.freshWindowMilliseconds,
    ],
  ),
)

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
  // The row only while it is inside the provider's fresh window — which is
  // zero for every provider except AniDB, so this is almost always null.
  get: (key: ProviderCacheKey) => ProviderCacheRow | null
  // The row at any age: the fallback when the live request fails, and the
  // ETag source for a conditional request.
  getStale: (
    key: ProviderCacheKey,
  ) => ProviderCacheRow | null
  isAvailable: boolean
  set: (
    props: ProviderCacheKey & {
      body: string
      etag?: string | null
      // Defaults to now. Set only when importing an answer the provider
      // gave earlier, so its age stays honest.
      fetchedAt?: number
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

// A provider the table does not name gets no window at all, so an
// unknown name can only ever make a read MORE current, never less.
const resolveFreshWindow = ({
  freshWindowByProvider,
  provider,
}: {
  freshWindowByProvider: Record<string, number>
  provider: string
}) => freshWindowByProvider[provider] ?? 0

const isRowFresh = ({
  freshWindowByProvider,
  provider,
  row,
}: {
  freshWindowByProvider: Record<string, number>
  provider: string
  row: ProviderCacheRow
}) =>
  Date.now() - row.fetchedAt <
  resolveFreshWindow({ freshWindowByProvider, provider })

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
  freshWindowByProvider,
}: {
  database: DatabaseSync
  databasePath: string
  freshWindowByProvider: Record<string, number>
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
        isRowFresh({
          freshWindowByProvider,
          provider,
          row,
        })
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
      fetchedAt = Date.now(),
      provider,
      requestKey,
    }: ProviderCacheKey & {
      body: string
      etag?: string | null
      fetchedAt?: number
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
              fetchedAt,
            )
        },
      })
    },
  }))({ isFirstLogPending: true })

export const openProviderCache = ({
  databasePath = providerCacheDatabasePath,
  freshWindowByProvider = PROVIDER_CACHE_FRESH_WINDOW,
}: {
  databasePath?: string
  freshWindowByProvider?: Record<string, number>
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
          freshWindowByProvider,
        }))(
    attempt(() => createConfiguredDatabase(databasePath)),
  )
