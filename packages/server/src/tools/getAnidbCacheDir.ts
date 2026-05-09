import { join, resolve } from "node:path"

// Directory where AniDB-related caches live (anime XML payloads and DDG
// search HTML). Defaults to ./.cache/anidb which is gitignored. Override
// with the ANIDB_CACHE_FOLDER env var when running in Docker so the cache
// can live on a mounted volume that survives container restarts.
export const getAnidbCacheDir = (): string => (
  resolve(process.env.ANIDB_CACHE_FOLDER ?? join(".cache", "anidb"))
)
