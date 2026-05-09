import { mkdir, readFile, stat, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { getAnidbCacheDir } from "./getAnidbCacheDir.js"

const ANIME_DIR = join(getAnidbCacheDir(), "anime")

// 7 days. Anime metadata is effectively static once a series finishes airing;
// in-flight series may add episodes more often, but a one-week window is a
// reasonable trade between freshness and AniDB's strict rate limits.
const ANIME_TTL_MS = 7 * 24 * 60 * 60 * 1000

// AniDB's published cap is 1 request per 2s. We pad by 0.5s to leave headroom.
// In-process only — across separate CLI invocations, the disk cache is what
// actually protects us from hammering the API.
const MIN_REQUEST_INTERVAL_MS = 2_500
let lastRequestAt = 0

const throttle = async (): Promise<void> => {
  const wait = MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt)
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
  lastRequestAt = Date.now()
}

const isFresh = async (path: string, maxAgeMs: number): Promise<boolean> => {
  try {
    const s = await stat(path)
    return Date.now() - s.mtimeMs < maxAgeMs
  }
  catch {
    return false
  }
}

export const getAnimeXml = async (
  aid: number,
  { client, clientver }: { client: string, clientver: string },
): Promise<string> => {
  const path = join(ANIME_DIR, `${aid}.xml`)
  if (await isFresh(path, ANIME_TTL_MS)) {
    return readFile(path, "utf8")
  }

  await mkdir(ANIME_DIR, { recursive: true })
  await throttle()

  // Node 18+ fetch auto-decodes Content-Encoding: gzip, so no manual gunzip.
  const url = (
    `http://api.anidb.net:9001/httpapi`
    + `?request=anime&aid=${aid}`
    + `&client=${encodeURIComponent(client)}`
    + `&clientver=${encodeURIComponent(clientver)}`
    + `&protover=1`
  )
  const res = await fetch(url)
  if (!res.ok) throw new Error(`AniDB anime fetch failed: ${res.status}`)

  const xml = await res.text()
  // AniDB returns an <error> root on failure (banned client, unknown aid,
  // etc.). Don't cache — let the next call retry after the throttle.
  if (xml.includes("<error")) {
    throw new Error(`AniDB error for aid=${aid}: ${xml.slice(0, 200)}`)
  }

  await writeFile(path, xml, "utf8")
  return xml
}
