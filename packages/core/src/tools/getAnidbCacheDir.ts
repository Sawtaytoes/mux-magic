import { join, resolve } from "node:path"

// Directory where the manami anime-offline-database lives. Until
// 2026-09-29 it also held one AniDB XML file per anime under `anime/`;
// those answers now live in `provider-cache.sqlite`, and a file left there
// is read once, to import it. Defaults to ./.cache/anidb which is
// gitignored. Override
// with the ANIDB_CACHE_FOLDER env var when running in Docker so the cache
// can live on a mounted volume that survives container restarts.
export const getAnidbCacheDir = (): string =>
  resolve(
    process.env.ANIDB_CACHE_FOLDER ??
      join(".cache", "anidb"),
  )
