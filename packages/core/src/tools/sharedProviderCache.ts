import {
  openProviderCache,
  providerCacheDatabasePath,
} from "../provider-cache/providerCache.js"

// A Map rather than a mutable field, so the lazy open stays an expression.
const sharedCache = new Map<
  "instance",
  ReturnType<typeof openProviderCache>
>()

// Every module that memoises a fetcher built on top of the shared cache
// registers here. Closing the database has to drop those fetchers too, or
// the next request reaches through a memoised closure into a closed
// handle. The music fetchers and the DVDCompare fetcher both do this, and
// neither should have to know the other exists.
const resetHandlers = new Set<() => void>()

export const registerProviderCacheResetHandler = (
  handler: () => void,
) => {
  resetHandlers.add(handler)
}

export const getSharedProviderCache = () =>
  sharedCache.get("instance") ??
  (sharedCache
    .set(
      "instance",
      openProviderCache({
        databasePath: providerCacheDatabasePath,
      }),
    )
    .get("instance") as ReturnType<
    typeof openProviderCache
  >)

export const closeSharedProviderCache = () => {
  sharedCache.get("instance")?.close()
  sharedCache.clear()
  resetHandlers.forEach((handler) => {
    handler()
  })
}
