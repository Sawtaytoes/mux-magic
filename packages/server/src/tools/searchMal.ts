import malScraper from "mal-scraper"
import {
  from,
  map,
  type Observable,
} from "rxjs"

import { logAndSwallow } from "./logAndSwallow.js"

export type MalResult = {
  airDate?: string
  imageUrl?: string
  malId: number
  mediaType?: string
  name: string
}

// Subset of mal-scraper's SearchResultsDataModel — only the fields we read.
// Defining it locally means the mapping helper can be tested with synthetic
// inputs without dragging in mal-scraper's type definitions.
export type MalRawResult = {
  id: string
  image_url?: string
  name: string
  payload?: {
    aired?: string
    media_type?: string
  }
  thumbnail_url?: string
}

export const mapMalSearchResults = (
  rawResults: MalRawResult[],
): MalResult[] => (
  rawResults
  .map((result) => ({
    airDate: result.payload?.aired,
    imageUrl: result.thumbnail_url ?? result.image_url,
    malId: Number(result.id),
    mediaType: result.payload?.media_type,
    name: result.name,
  }))
  .filter((result) => result.malId > 0)
)

export const searchMal = (
  searchTerm: string,
): Observable<MalResult[]> => (
  from(
    malScraper
    .getResultsFromSearch(
      searchTerm,
      "anime",
    )
  )
  .pipe(
    map(mapMalSearchResults),
  )
)

export const lookupMalById = (
  malId: number,
): Observable<{ name: string } | null> => (
  from(
    malScraper
    .getInfoFromURL(`https://myanimelist.net/anime/${malId}`)
  )
  .pipe(
    map((info) => {
      const name = (
        info.englishTitle
        || info.title
        || info.synonyms?.[0]
        || info.japaneseTitle
        || ""
      )
      return name ? { name } : null
    }),
    logAndSwallow(lookupMalById),
  )
)
