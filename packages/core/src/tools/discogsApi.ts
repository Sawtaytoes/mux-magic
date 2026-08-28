import { from, map } from "rxjs"

import type { CachedFetch } from "./musicBrainzApi.js"

export const DISCOGS_BASE_URL = "https://api.discogs.com"
export const DISCOGS_QUERY_LIMIT = 50

export type DiscogsRawArtist = {
  id?: number
  join?: string
  name?: string
}

export type DiscogsRawTrack = {
  artists?: DiscogsRawArtist[]
  duration?: string
  position?: string
  title?: string
  type_?: string
}

export type DiscogsRawRelease = {
  artists?: DiscogsRawArtist[]
  country?: string
  formats?: { descriptions?: string[]; name?: string }[]
  genres?: string[]
  id?: number
  labels?: { name?: string }[]
  released?: string
  styles?: string[]
  title?: string
  tracklist?: DiscogsRawTrack[]
  year?: number
}

export type DiscogsRawSearch = {
  results?: DiscogsRawRelease[]
}

export type DiscogsArtistCreditPart = {
  artistId: string
  joinPhrase: string
  name: string
}

export type DiscogsTrack = {
  artistCredit: DiscogsArtistCreditPart[]
  discNumber: number
  lengthMilliseconds: number | null
  position: number
  title: string
}

export type DiscogsRelease = {
  artistCredit: DiscogsArtistCreditPart[]
  country: string
  formats: string[]
  genres: string[]
  labels: string[]
  releaseId: string
  title: string
  trackCount: number
  tracks: DiscogsTrack[]
  year: string
}

const undefinedWhenEmpty = (value: string | undefined) =>
  value !== undefined && value.trim().length > 0
    ? value.trim()
    : undefined

// Discogs adds `(2)` and similar suffixes to distinguish artists with the
// same display name. They are database disambiguators, not tag text.
const stripArtistDisambiguator = (name: string) =>
  name.replace(/ \(\d+\)$/u, "")

const mapArtistCredit = (
  artists: DiscogsRawArtist[] | undefined,
) =>
  (artists ?? [])
    .map((artist) => ({
      artistId:
        typeof artist.id === "number"
          ? String(artist.id)
          : "",
      joinPhrase: artist.join ?? "",
      name: stripArtistDisambiguator(artist.name ?? ""),
    }))
    .filter((artist) => artist.name.length > 0)

const joinArtistCredit = (
  artistCredit: DiscogsArtistCreditPart[],
) =>
  artistCredit
    .map((artist) => `${artist.name}${artist.joinPhrase}`)
    .join("")
    .trim()

const parseDurationMilliseconds = (
  duration: string | undefined,
) =>
  ((parts: string[]) =>
    parts.length === 2 &&
    parts.every((part) => /^\d+$/u.test(part))
      ? (Number(parts[0]) * 60 + Number(parts[1])) * 1_000
      : null)((duration ?? "").split(":"))

const parseTrackPosition = ({
  fallbackPosition,
  position,
}: {
  fallbackPosition: number
  position: string | undefined
}) =>
  ((match: RegExpMatchArray | null) =>
    match === null
      ? { discNumber: 1, position: fallbackPosition }
      : {
          discNumber: Number(match[1] ?? 1),
          position: Number(
            match[2] ?? match[1] ?? fallbackPosition,
          ),
        })((position ?? "").match(/^(?:(\d+)[-.])?(\d+)$/u))

const mapTracks = (
  tracklist: DiscogsRawTrack[] | undefined,
) =>
  (tracklist ?? [])
    .filter((track) => track.type_ === "track")
    .map((track, trackIndex) => ({
      artistCredit: mapArtistCredit(track.artists),
      ...parseTrackPosition({
        fallbackPosition: trackIndex + 1,
        position: track.position,
      }),
      lengthMilliseconds: parseDurationMilliseconds(
        track.duration,
      ),
      title: track.title ?? "",
    }))
    .filter((track) => track.title.length > 0)

const mapFormats = (
  formats: DiscogsRawRelease["formats"],
) =>
  (formats ?? []).flatMap((format) =>
    [format.name, ...(format.descriptions ?? [])].filter(
      (part): part is string =>
        typeof part === "string" && part.length > 0,
    ),
  )

const mapNames = (
  values: { name?: string }[] | undefined,
) =>
  (values ?? [])
    .map((value) => undefinedWhenEmpty(value.name))
    .filter((value): value is string => value !== undefined)

export const mapDiscogsRelease = (
  rawRelease: DiscogsRawRelease,
): DiscogsRelease => {
  const tracks = mapTracks(rawRelease.tracklist)
  return {
    artistCredit: mapArtistCredit(rawRelease.artists),
    country: rawRelease.country ?? "",
    formats: mapFormats(rawRelease.formats),
    genres: [
      ...(rawRelease.genres ?? []),
      ...(rawRelease.styles ?? []),
    ],
    labels: mapNames(rawRelease.labels),
    releaseId:
      typeof rawRelease.id === "number"
        ? String(rawRelease.id)
        : "",
    title: rawRelease.title ?? "",
    trackCount: tracks.length,
    tracks,
    year:
      rawRelease.released?.slice(0, 4) ??
      (typeof rawRelease.year === "number"
        ? String(rawRelease.year)
        : ""),
  }
}

const buildSearchUrl = ({
  albumName,
  artistName,
}: {
  albumName: string
  artistName: string
}) => {
  const searchParameters = new URLSearchParams({
    artist: artistName,
    per_page: String(DISCOGS_QUERY_LIMIT),
    release_title: albumName,
    type: "release",
  })
  return `${DISCOGS_BASE_URL}/database/search?${searchParameters.toString()}`
}

export const searchDiscogsReleases = ({
  albumName,
  artistName,
  cachedFetch,
}: {
  albumName: string
  artistName: string
  cachedFetch: CachedFetch
}) =>
  from(
    cachedFetch(buildSearchUrl({ albumName, artistName }), {
      cacheKey: `search:${artistName}:${albumName}`,
    }),
  ).pipe(
    map(({ body }) => JSON.parse(body) as DiscogsRawSearch),
    map((response) =>
      (response.results ?? [])
        .filter((release) => typeof release.id === "number")
        .map(mapDiscogsRelease),
    ),
  )

export const getDiscogsRelease = ({
  cachedFetch,
  releaseId,
}: {
  cachedFetch: CachedFetch
  releaseId: string
}) =>
  from(
    cachedFetch(
      `${DISCOGS_BASE_URL}/releases/${releaseId}`,
      {
        cacheKey: `release:${releaseId}`,
      },
    ),
  ).pipe(
    map(({ body }) =>
      mapDiscogsRelease(
        JSON.parse(body) as DiscogsRawRelease,
      ),
    ),
  )

export const discogsArtistName = (
  release: DiscogsRelease,
) => joinArtistCredit(release.artistCredit)
