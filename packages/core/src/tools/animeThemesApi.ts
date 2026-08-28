import {
  mkdir,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises"
import { join } from "node:path"
import { getAnimeXml } from "./anidbApi.js"
import { getAnidbCacheDir } from "./getAnidbCacheDir.js"

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000
const MIN_REQUEST_INTERVAL_MS = 1_500
const cachePath = join(getAnidbCacheDir(), "anime-themes")

export type AnimeTheme = {
  artist: string | null
  audioUrl: string
  slug: string
  song: string
}

export type ResolvedAnimeTheme = AnimeTheme & {
  fallbackAnidbId: number | null
  source: "main-show-candidate" | "own"
}

type AnimeThemesResourceResponse = {
  resources?: Array<{ anime?: Array<{ slug?: string }> }>
}

type AnimeThemesAnimeResponse = {
  anime?: {
    animethemes?: Array<{
      sequence?: number
      slug?: string
      song?: {
        artists?: Array<{ name?: string }>
        title?: string
      }
      type?: string
      animethemeentries?: Array<{
        videos?: Array<{
          audio?: { link?: string }
          source?: string
          resolution?: number
          [field: string]: unknown
        }>
      }>
    }>
  }
}

let nextRequestAt = 0
let throttleChain: Promise<void> = Promise.resolve()

const waitForRequestSlot = () => {
  throttleChain = throttleChain.then(async () => {
    const waitMilliseconds = Math.max(
      0,
      nextRequestAt - Date.now(),
    )
    if (waitMilliseconds > 0) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, waitMilliseconds)
      })
    }
    nextRequestAt = Date.now() + MIN_REQUEST_INTERVAL_MS
  })
  return throttleChain
}

const isFresh = async (filePath: string) => {
  try {
    const fileStats = await stat(filePath)
    return Date.now() - fileStats.mtimeMs < CACHE_TTL_MS
  } catch {
    return false
  }
}

const readCachedJson = async <T>(filePath: string) => {
  const hasFreshCache = await isFresh(filePath)
  return hasFreshCache
    ? (JSON.parse(await readFile(filePath, "utf8")) as T)
    : null
}

const fetchJson = async <T>({
  cacheFileName,
  url,
}: {
  cacheFileName: string
  url: string
}) => {
  const filePath = join(cachePath, cacheFileName)
  const cachedResponse = await readCachedJson<T>(filePath)
  if (cachedResponse !== null) {
    return cachedResponse
  }
  await mkdir(cachePath, { recursive: true })
  await waitForRequestSlot()
  const response = await fetch(url, {
    headers: { "User-Agent": "mux-magic/1.0" },
  })
  if (!response.ok) {
    throw new Error(
      `AnimeThemes request failed: ${response.status}`,
    )
  }
  const responseBody = (await response.json()) as T
  await writeFile(
    filePath,
    JSON.stringify(responseBody),
    "utf8",
  )
  return responseBody
}

const sourceRank = (source: string | undefined) =>
  ({ BD: 3, WEB: 2, DVD: 1 })[source ?? ""] ?? 0

const selectAudio = (
  videos: NonNullable<
    NonNullable<
      NonNullable<
        AnimeThemesAnimeResponse["anime"]
      >["animethemes"]
    >[number]["animethemeentries"]
  >[number]["videos"],
) =>
  (videos ?? [])
    .filter((video) => video.audio?.link !== undefined)
    .toSorted(
      (left, right) =>
        Number(Boolean(right.nc)) -
          Number(Boolean(left.nc)) ||
        sourceRank(right.source) -
          sourceRank(left.source) ||
        (right.resolution ?? 0) - (left.resolution ?? 0),
    )[0]

export const getAnimeTheme = async (anidbId: number) => {
  const resourceResponse =
    await fetchJson<AnimeThemesResourceResponse>({
      cacheFileName: `resource-${anidbId}.json`,
      url: `https://api.animethemes.moe/resource?filter[external_id]=${anidbId}&filter[site]=AniDB&include=anime`,
    })
  const animeSlug =
    resourceResponse.resources?.[0]?.anime?.[0]?.slug
  if (animeSlug === undefined) {
    return null
  }
  const animeResponse =
    await fetchJson<AnimeThemesAnimeResponse>({
      cacheFileName: `anime-${animeSlug}.json`,
      url: `https://api.animethemes.moe/anime/${encodeURIComponent(animeSlug)}?include=animethemes.song.artists,animethemes.animethemeentries.videos.audio`,
    })
  const opening = (animeResponse.anime?.animethemes ?? [])
    .filter((theme) => theme.type === "OP")
    .toSorted(
      (left, right) =>
        Number(left.slug !== "OP1") -
          Number(right.slug !== "OP1") ||
        (left.sequence ?? Number.MAX_SAFE_INTEGER) -
          (right.sequence ?? Number.MAX_SAFE_INTEGER),
    )
    .map((theme) => ({
      theme,
      video: selectAudio(
        theme.animethemeentries?.flatMap(
          (entry) => entry.videos ?? [],
        ),
      ),
    }))
    .find(({ video }) => video?.audio?.link !== undefined)
  return opening?.video?.audio?.link === undefined
    ? null
    : {
        artist:
          opening.theme.song?.artists
            ?.map(({ name }) => name)
            .filter(
              (name): name is string => name !== undefined,
            )
            .join(", ") ?? null,
        audioUrl: opening.video.audio.link,
        slug: animeSlug,
        song:
          opening.theme.song?.title ??
          opening.theme.slug ??
          "Unknown opening",
      }
}

const getMainShowAnidbIds = (animeXml: string) =>
  Array.from(
    animeXml.matchAll(
      /<anime id="(?<anidbId>\d+)" type="(?<relation>Parent Story|Prequel)">/g,
    ),
  ).map((match) => Number(match.groups?.anidbId))

export const getAnimeThemeWithMainShowFallback = async (
  anidbId: number,
): Promise<ResolvedAnimeTheme | null> => {
  const ownTheme = await getAnimeTheme(anidbId)
  if (ownTheme !== null) {
    return {
      ...ownTheme,
      fallbackAnidbId: null,
      source: "own",
    }
  }
  const animeXml = await getAnimeXml(anidbId, {
    client: "mediatools",
    clientver: "1",
  })
  const fallbackAnidbIds = getMainShowAnidbIds(animeXml)
  const fallbackThemes = await Promise.all(
    fallbackAnidbIds.map(async (fallbackAnidbId) => ({
      fallbackAnidbId,
      theme: await getAnimeTheme(fallbackAnidbId),
    })),
  )
  const fallbackTheme = fallbackThemes.find(
    ({ theme }) => theme !== null,
  )
  return fallbackTheme?.theme === null ||
    fallbackTheme === undefined
    ? null
    : {
        ...fallbackTheme.theme,
        fallbackAnidbId: fallbackTheme.fallbackAnidbId,
        source: "main-show-candidate",
      }
}
