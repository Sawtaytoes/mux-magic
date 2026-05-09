import { XMLParser } from "fast-xml-parser"
import { from, map, type Observable } from "rxjs"

import type { AnidbAnime, AnidbEpisodeType, AnidbTitleType } from "../types/anidb.js"
import { logAndSwallow } from "./logAndSwallow.js"
import { findAnimeByQuery, loadAnimeIndex } from "./animeOfflineDatabase.js"
import { getAnimeXml } from "./anidbApi.js"

// AniDB HTTP API client identifiers — public, not secrets. Tied to the
// software registered at https://anidb.net/software/3767 (display name
// "Disc File Namer"). Bump CLIENT_VER when you re-register a new version
// on AniDB to track API usage against the matching release.
const CLIENT = "mediatools"
const CLIENT_VER = "1"

export type AnidbResult = {
  aid: number,
  episodes?: number,
  name: string,
  type?: string,
}

// Search is backed by the manami-project anime-offline-database (see
// animeOfflineDatabase.ts). anidb.net itself sits behind Cloudflare's
// interactive challenge and the HTTP API has no name-search endpoint, so
// we route name → aid through the community-maintained JSON dataset.
export const searchAnidb = (
  searchTerm: string,
): Observable<AnidbResult[]> => (
  from(loadAnimeIndex())
  .pipe(
    map((index) => (
      findAnimeByQuery(index, searchTerm)
      .map((entry) => ({
        aid: entry.aid,
        episodes: entry.episodes,
        name: entry.name,
        type: entry.type,
      }))
    )),
    logAndSwallow(searchAnidb),
  )
)

const xmlParser = new XMLParser({
  attributeNamePrefix: "",
  ignoreAttributes: false,
  textNodeName: "value",
})

const toArray = <T>(v: T | T[] | undefined): T[] => (
  v == null ? [] : Array.isArray(v) ? v : [v]
)

// Picks the most user-recognizable display name for an anime from
// AniDB's titles list. Preference: official English → main (typically
// romaji) → first official in any language → first available.
export const pickAnidbSeriesName = (titles: AnidbAnime["titles"]): string => (
  titles.find((t) => t.type === "official" && t.lang === "en")?.value
  ?? titles.find((t) => t.type === "main")?.value
  ?? titles.find((t) => t.type === "official")?.value
  ?? titles[0]?.value
  ?? ""
)

export const parseAnidbAnimeXml = (xml: string): AnidbAnime | null => {
  const root = (xmlParser.parse(xml) as { anime?: any }).anime
  if (!root) return null

  const titles = (
    toArray<any>(root.titles?.title)
    .map((t) => ({
      lang: String(t["xml:lang"] ?? ""),
      type: String(t.type ?? "synonym") as AnidbTitleType,
      value: typeof t === "string" ? t : String(t.value ?? ""),
    }))
  )

  const episodes = (
    toArray<any>(root.episodes?.episode)
    .map((ep) => ({
      airdate: ep.airdate ? String(ep.airdate) : undefined,
      epno: typeof ep.epno === "string" ? ep.epno : String(ep.epno?.value ?? ""),
      length: ep.length != null ? Number(ep.length) : undefined,
      titles: (
        toArray<any>(ep.title)
        .map((t) => ({
          lang: String(t["xml:lang"] ?? ""),
          value: typeof t === "string" ? t : String(t.value ?? ""),
        }))
      ),
      type: Number(ep.epno?.type ?? 1) as AnidbEpisodeType,
    }))
  )

  return { aid: Number(root.id), episodes, titles }
}

export const lookupAnidbById = (
  aid: number,
): Observable<AnidbAnime | null> => (
  from(getAnimeXml(aid, { client: CLIENT, clientver: CLIENT_VER }))
  .pipe(
    map(parseAnidbAnimeXml),
    logAndSwallow(lookupAnidbById),
  )
)
