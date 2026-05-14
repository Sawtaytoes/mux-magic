// Reverse-lookup helpers: given a numeric ID and a lookup type, fetch the
// human-readable name from the matching /queries/lookup* endpoint.
//
// Token-based cancellation (see NumberWithLookupField.tsx): callers store the
// raw value as a token alongside the request; when the response lands, the
// caller compares against the latest token and discards stale results.

import type {
  LabelLookupResponse,
  LookupAnidbRequest,
  LookupDvdCompareReleaseRequest,
  LookupDvdCompareRequest,
  LookupMalRequest,
  LookupMovieDbRequest,
  LookupTvdbRequest,
  NameLookupResponse,
  SearchMovieDbResponse,
} from "@mux-magic/server/api-types"
import { apiBase } from "../../apiBase"
import type { LookupType } from "../LookupModal/types"

// eslint-disable-next-line no-restricted-syntax -- web-only discriminated union pairing each endpoint with its server-defined request body; the body shapes themselves are imported from api-types above
type ReverseLookupRequest =
  | {
      endpoint: "/queries/lookupMal"
      body: LookupMalRequest
    }
  | {
      endpoint: "/queries/lookupAnidb"
      body: LookupAnidbRequest
    }
  | {
      endpoint: "/queries/lookupTvdb"
      body: LookupTvdbRequest
    }
  | {
      endpoint: "/queries/lookupMovieDb"
      body: LookupMovieDbRequest
    }
  | {
      endpoint: "/queries/lookupDvdCompare"
      body: LookupDvdCompareRequest
    }
  | {
      endpoint: "/queries/lookupDvdCompareRelease"
      body: LookupDvdCompareReleaseRequest
    }

export const buildReverseLookupRequest = (args: {
  fieldName: string
  lookupType: LookupType | undefined
  numericId: number
  dvdCompareId?: number | undefined
}): ReverseLookupRequest | null => {
  const { fieldName, lookupType, numericId, dvdCompareId } =
    args
  if (lookupType === "mal") {
    return {
      endpoint: "/queries/lookupMal",
      body: { malId: numericId },
    }
  }
  if (lookupType === "anidb") {
    return {
      endpoint: "/queries/lookupAnidb",
      body: { anidbId: numericId },
    }
  }
  if (lookupType === "tvdb") {
    return {
      endpoint: "/queries/lookupTvdb",
      body: { tvdbId: numericId },
    }
  }
  if (lookupType === "tmdb") {
    return {
      endpoint: "/queries/lookupMovieDb",
      body: { movieDbId: numericId },
    }
  }
  if (lookupType === "dvdcompare") {
    return {
      endpoint: "/queries/lookupDvdCompare",
      body: { dvdCompareId: numericId },
    }
  }
  if (
    fieldName === "dvdCompareReleaseHash" &&
    dvdCompareId
  ) {
    return {
      endpoint: "/queries/lookupDvdCompareRelease",
      body: {
        dvdCompareId,
        hash: String(numericId),
      },
    }
  }
  return null
}

export const runReverseLookup = async (
  request: ReverseLookupRequest,
): Promise<string | null> => {
  try {
    const response = await fetch(
      `${apiBase}${request.endpoint}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.body),
      },
    )
    if (!response.ok) return null
    const data = (await response.json()) as
      | NameLookupResponse
      | LabelLookupResponse
    if ("name" in data) return data.name ?? null
    if ("label" in data) return data.label ?? null
    return null
  } catch {
    return null
  }
}

export const resolveTmdbForBaseTitle = async (args: {
  baseTitle: string
  year: string
}): Promise<{
  tmdbId: number
  tmdbName: string
} | null> => {
  if (!args.baseTitle) return null
  try {
    const response = await fetch(
      `${apiBase}/queries/searchMovieDb`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          searchTerm: args.baseTitle,
          year: args.year || undefined,
        }),
      },
    )
    if (!response.ok) return null
    const data =
      (await response.json()) as SearchMovieDbResponse
    const top = data.results?.[0]
    if (!top?.movieDbId) return null
    const tmdbName = top.year
      ? `${top.title} (${top.year})`
      : (top.title ?? "")
    return {
      tmdbId: top.movieDbId,
      tmdbName,
    }
  } catch {
    return null
  }
}
