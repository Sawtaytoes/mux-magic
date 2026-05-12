import {
  mkdir,
  readFile,
  stat,
  utimes,
  writeFile,
} from "node:fs/promises"
import { join } from "node:path"

import { getAnidbCacheDir } from "./getAnidbCacheDir.js"
import { logError, logInfo } from "./logMessage.js"

// manami-project/anime-offline-database is a community-maintained JSON
// dataset that cross-references AniDB / MAL / AniList / Kitsu ids. We use
// it for name → aid lookup because anidb.net itself is behind a Cloudflare
// interactive challenge and the HTTP API has no search endpoint.
//
// Hosted via GitHub Releases. /releases/latest/download/ 302-redirects to
// the current weekly version (e.g., /releases/download/2026-14/...). We
// extract the version slug from the redirect to do a cheap freshness
// check before downloading the full ~61 MB payload.

const LATEST_URL =
  "https://github.com/manami-project/anime-offline-database/releases/latest/download/anime-offline-database-minified.json"

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000

const ANIDB_AID_PATTERN =
  /^https?:\/\/anidb\.net\/anime\/(\d+)\/?$/i

const cacheDir = (): string =>
  join(getAnidbCacheDir(), "manami")
const dataPath = (): string =>
  join(cacheDir(), "anime-offline-database.json")
const versionPath = (): string =>
  join(cacheDir(), "version")

// Subset of the manami entry shape — only the fields we read.
type ManamiEntry = {
  episodes?: number
  sources?: string[]
  synonyms?: string[]
  title: string
  type?: string
}

export type AnimeIndexEntry = {
  aid: number
  episodes?: number
  // Lowercased title + synonyms joined with "\n", precomputed so search
  // is a single .includes() call per entry.
  matchHaystack: string
  name: string
  type?: string
}

const isFresh = async (
  path: string,
  maxAgeMs: number,
): Promise<boolean> => {
  try {
    const stats = await stat(path)
    return Date.now() - stats.mtimeMs < maxAgeMs
  } catch {
    return false
  }
}

const resolveLatestVersion = async (): Promise<string> => {
  const res = await fetch(LATEST_URL, {
    method: "HEAD",
    redirect: "manual",
  })
  const location = res.headers.get("location")
  if (!location)
    throw new Error(
      "manami: HEAD response had no Location header",
    )
  const match = location.match(
    /\/releases\/download\/([^/]+)\//,
  )
  if (!match)
    throw new Error(
      `manami: unexpected redirect URL ${location}`,
    )
  return match[1]
}

const downloadDataset = async (): Promise<void> => {
  const res = await fetch(LATEST_URL)
  if (!res.ok)
    throw new Error(
      `manami: download failed (${res.status})`,
    )
  const buf = Buffer.from(await res.arrayBuffer())
  await writeFile(dataPath(), buf)
}

let refreshPromise: Promise<void> | null = null

const refreshIfStale = async (): Promise<void> => {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    try {
      if (await isFresh(dataPath(), REFRESH_TTL_MS)) return

      await mkdir(cacheDir(), { recursive: true })

      let storedVersion = ""
      try {
        storedVersion = (
          await readFile(versionPath(), "utf8")
        ).trim()
      } catch {
        /* missing version file is fine */
      }

      let latestVersion: string
      try {
        latestVersion = await resolveLatestVersion()
      } catch (err) {
        logError(
          "manami HEAD check failed; using cached dataset",
          String(err),
        )
        if (storedVersion) {
          // Bump mtime so we don't keep retrying every call.
          const now = new Date()
          try {
            await utimes(dataPath(), now, now)
          } catch {
            /* ignore */
          }
          return
        }
        throw err
      }

      if (latestVersion === storedVersion) {
        const now = new Date()
        try {
          await utimes(dataPath(), now, now)
        } catch {
          /* ignore */
        }
        return
      }

      logInfo(
        "manami",
        `downloading dataset version ${latestVersion}…`,
      )
      await downloadDataset()
      await writeFile(versionPath(), latestVersion)
      logInfo(
        "manami",
        `downloaded dataset version ${latestVersion}`,
      )
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

export const parseAnimeIndex = (
  rawJson: string,
): AnimeIndexEntry[] => {
  const parsed = JSON.parse(rawJson) as {
    data?: ManamiEntry[]
  }
  const data = parsed.data ?? []

  const index: AnimeIndexEntry[] = []
  for (const entry of data) {
    let aid: number | null = null
    for (const src of entry.sources ?? []) {
      const match = src.match(ANIDB_AID_PATTERN)
      if (match) {
        aid = Number(match[1])
        break
      }
    }
    if (!aid) continue

    const haystack = [
      entry.title,
      ...(entry.synonyms ?? []),
    ]
      .join("\n")
      .toLowerCase()

    index.push({
      aid,
      episodes: entry.episodes,
      matchHaystack: haystack,
      name: entry.title,
      type: entry.type,
    })
  }
  return index
}

export const findAnimeByQuery = (
  index: AnimeIndexEntry[],
  query: string,
  limit = 50,
): AnimeIndexEntry[] => {
  const needle = query.toLowerCase().trim()
  if (!needle) return []

  const hits: AnimeIndexEntry[] = []
  for (const entry of index) {
    if (entry.matchHaystack.includes(needle)) {
      hits.push(entry)
      if (hits.length >= limit) break
    }
  }
  return hits
}

let cachedIndex: AnimeIndexEntry[] | null = null
let cachedAtMtime = 0

export const loadAnimeIndex = async (): Promise<
  AnimeIndexEntry[]
> => {
  await refreshIfStale()

  // Long-running processes (the API server) can outlive multiple weekly
  // refreshes. Re-stat the file and reload only if mtime moved.
  const stats = await stat(dataPath()).catch(() => null)
  if (
    cachedIndex &&
    stats &&
    stats.mtimeMs === cachedAtMtime
  )
    return cachedIndex

  const raw = await readFile(dataPath(), "utf8")
  cachedIndex = parseAnimeIndex(raw)
  if (stats) cachedAtMtime = stats.mtimeMs
  return cachedIndex
}
