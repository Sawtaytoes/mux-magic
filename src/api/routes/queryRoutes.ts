import { sep as pathSeparator } from "node:path"

import { OpenAPIHono, createRoute } from "@hono/zod-openapi"
import { lastValueFrom } from "rxjs"

import {
  fakeGetSubtitleMetadata,
  fakeLabelLookup,
  fakeListDirectoryEntries,
  fakeListDvdCompareReleases,
  fakeNameLookup,
  fakeSearchAnidb,
  fakeSearchDvdCompare,
  fakeSearchMal,
  fakeSearchMovieDb,
  fakeSearchTvdb,
  isFakeRequest,
} from "../../fake-data/index.js"
import { getSubtitleMetadata } from "../../app-commands/getSubtitleMetadata.js"
import {
  findDvdCompareResults,
  listDvdCompareReleases,
  lookupDvdCompareFilm,
  lookupDvdCompareRelease,
} from "../../tools/searchDvdCompare.js"
import { listDirectoryEntries } from "../../tools/listDirectoryEntries.js"
import { lookupAnidbById, pickAnidbSeriesName, searchAnidb } from "../../tools/searchAnidb.js"
import { lookupMalById, searchMal } from "../../tools/searchMal.js"
import { lookupMovieDbById, searchMovieDb } from "../../tools/searchMovieDb.js"
import { lookupTvdbById, searchTvdb } from "../../tools/searchTvdb.js"
import * as schemas from "../schemas.js"

export const queryRoutes = new OpenAPIHono()

// Pulls the most informative message out of an error that may have a
// nested cause (e.g. Node's TypeError(fetch failed) wraps ConnectTimeoutError).
const messageFromError = (error: unknown): string => {
  if (error instanceof Error) {
    if (error.cause instanceof Error && error.cause.message) {
      return error.cause.message
    }
    return error.message || String(error)
  }
  return String(error)
}

queryRoutes.openapi(
  createRoute({
    method: "post",
    path: "/queries/getSubtitleMetadata",
    summary: "Read .ass subtitle file metadata without making any changes",
    description: "Parses every .ass file in the given directory and returns their [Script Info] properties and [V4+ Styles] entries as JSON. Use this to inspect files before deciding which DSL rules to send to POST /commands/modifySubtitleMetadata.",
    tags: ["Subtitle Operations"],
    request: {
      body: {
        content: {
          "application/json": { schema: schemas.getSubtitleMetadataRequestSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Script Info and style metadata for each .ass file found",
        content: {
          "application/json": {
            schema: schemas.getSubtitleMetadataResponseSchema,
          },
        },
      },
    },
  }),
  async (context) => {
    if (isFakeRequest(context)) {
      return context.json(fakeGetSubtitleMetadata(), 200)
    }
    const body = context.req.valid("json")
    const subtitlesMetadata = await lastValueFrom(
      getSubtitleMetadata({
        isRecursive: body.isRecursive,
        recursiveDepth: body.recursiveDepth,
        sourcePath: body.sourcePath,
      })
    )
    return context.json({ subtitlesMetadata }, 200)
  },
)

queryRoutes.openapi(
  createRoute({
    method: "post",
    path: "/queries/searchMal",
    summary: "Search MyAnimeList for an anime title",
    description: "Returns up to 10 anime matching the search term. Use this from the builder UI to populate the malId field.",
    tags: ["Naming Operations"],
    request: {
      body: {
        content: {
          "application/json": { schema: schemas.searchTermRequestSchema },
        },
      },
    },
    responses: {
      200: {
        description: "MAL search results",
        content: {
          "application/json": { schema: schemas.searchMalResponseSchema },
        },
      },
    },
  }),
  async (context) => {
    if (isFakeRequest(context)) {
      return context.json(fakeSearchMal(), 200)
    }
    const body = context.req.valid("json")
    try {
      const results = await lastValueFrom(searchMal(body.searchTerm))
      return context.json({ results, error: null }, 200)
    } catch (err) {
      const message = messageFromError(err)
      console.error("[searchMal]", message)
      return context.json({ results: [], error: message }, 200)
    }
  },
)

queryRoutes.openapi(
  createRoute({
    method: "post",
    path: "/queries/searchAnidb",
    summary: "Search AniDB for an anime title",
    description: "Returns up to 50 anime matching the search term. Backed by the manami-project anime-offline-database (cached locally, refreshed weekly) — anidb.net itself sits behind Cloudflare and the HTTP API has no name-search endpoint.",
    tags: ["Naming Operations"],
    request: {
      body: {
        content: {
          "application/json": { schema: schemas.searchTermRequestSchema },
        },
      },
    },
    responses: {
      200: {
        description: "AniDB search results",
        content: {
          "application/json": { schema: schemas.searchAnidbResponseSchema },
        },
      },
    },
  }),
  async (context) => {
    if (isFakeRequest(context)) {
      return context.json(fakeSearchAnidb(), 200)
    }
    const body = context.req.valid("json")
    try {
      const results = await lastValueFrom(searchAnidb(body.searchTerm))
      return context.json({ results, error: null }, 200)
    } catch (err) {
      const message = messageFromError(err)
      console.error("[searchAnidb]", message)
      return context.json({ results: [], error: message }, 200)
    }
  },
)

queryRoutes.openapi(
  createRoute({
    method: "post",
    path: "/queries/lookupAnidb",
    summary: "Reverse-lookup an AniDB anime by aid",
    description: "Used by the builder when the user manually edits the AniDB ID — returns the display name resolved from the AniDB HTTP API.",
    tags: ["Naming Operations"],
    request: {
      body: {
        content: {
          "application/json": { schema: schemas.lookupAnidbRequestSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Series name (or null if not found)",
        content: {
          "application/json": { schema: schemas.nameLookupResponseSchema },
        },
      },
    },
  }),
  async (context) => {
    if (isFakeRequest(context)) {
      return context.json(fakeNameLookup(), 200)
    }
    const body = context.req.valid("json")
    try {
      const anime = await lastValueFrom(lookupAnidbById(body.anidbId))
      const name = anime ? pickAnidbSeriesName(anime.titles) : ""
      return context.json({ name: name || null }, 200)
    } catch (err) {
      const message = messageFromError(err)
      console.error("[lookupAnidb]", message)
      return context.json({ name: null }, 200)
    }
  },
)

queryRoutes.openapi(
  createRoute({
    method: "post",
    path: "/queries/searchTvdb",
    summary: "Search TheTVDB for a series",
    description: "Returns series matching the search term. Use this from the builder UI to populate the tvdbId field.",
    tags: ["Naming Operations"],
    request: {
      body: {
        content: {
          "application/json": { schema: schemas.searchTermRequestSchema },
        },
      },
    },
    responses: {
      200: {
        description: "TVDB search results",
        content: {
          "application/json": { schema: schemas.searchTvdbResponseSchema },
        },
      },
    },
  }),
  async (context) => {
    if (isFakeRequest(context)) {
      return context.json(fakeSearchTvdb(), 200)
    }
    const body = context.req.valid("json")
    try {
      const results = await lastValueFrom(searchTvdb(body.searchTerm))
      return context.json({ results, error: null }, 200)
    } catch (err) {
      const message = messageFromError(err)
      console.error("[searchTvdb]", message)
      return context.json({ results: [], error: message }, 200)
    }
  },
)

queryRoutes.openapi(
  createRoute({
    method: "post",
    path: "/queries/searchMovieDb",
    summary: "Search The Movie Database (TMDB) for a film",
    description: "Returns up to 20 movies matching the search term. Optional `year` narrows results so the builder can resolve the right film when title is shared across eras (e.g. 'Soldier' 1998 vs 1982). Used by the builder to populate the movieDbId field for nameMovies and to confirm the canonical match for nameSpecialFeatures. Requires TMDB_API_KEY in the environment.",
    tags: ["Naming Operations"],
    request: {
      body: {
        content: {
          "application/json": { schema: schemas.searchMovieDbRequestSchema },
        },
      },
    },
    responses: {
      200: {
        description: "TMDB search results",
        content: {
          "application/json": { schema: schemas.searchMovieDbResponseSchema },
        },
      },
    },
  }),
  async (context) => {
    if (isFakeRequest(context)) {
      return context.json(fakeSearchMovieDb(), 200)
    }
    const body = context.req.valid("json")
    try {
      const results = await lastValueFrom(searchMovieDb(body.searchTerm, body.year))
      return context.json({ results, error: null }, 200)
    } catch (err) {
      const message = messageFromError(err)
      console.error("[searchMovieDb]", message)
      return context.json({ results: [], error: message }, 200)
    }
  },
)

queryRoutes.openapi(
  createRoute({
    method: "post",
    path: "/queries/searchDvdCompare",
    summary: "Search DVDCompare.net for a film",
    description: "Returns film entries (DVD/Blu-ray/4K variants) matching the search term. Each result includes the variant so the builder UI can group by base title.",
    tags: ["Naming Operations"],
    request: {
      body: {
        content: {
          "application/json": { schema: schemas.searchTermRequestSchema },
        },
      },
    },
    responses: {
      200: {
        description: "DVDCompare search results",
        content: {
          "application/json": { schema: schemas.searchDvdCompareResponseSchema },
        },
      },
    },
  }),
  async (context) => {
    if (isFakeRequest(context)) {
      return context.json(fakeSearchDvdCompare(), 200)
    }
    const body = context.req.valid("json")
    try {
      const results = await lastValueFrom(findDvdCompareResults(body.searchTerm))
      return context.json({ results, error: null }, 200)
    } catch (err) {
      const message = messageFromError(err)
      console.error("[searchDvdCompare]", message)
      return context.json({ results: [], error: message }, 200)
    }
  },
)

queryRoutes.openapi(
  createRoute({
    method: "post",
    path: "/queries/listDvdCompareReleases",
    summary: "List release packages for a DVDCompare film",
    description: "Scrapes the film page to enumerate the release packages (e.g., 'Blu-ray ALL America - Arrow Films - Limited Edition'). Each release has a hash that becomes the URL fragment.",
    tags: ["Naming Operations"],
    request: {
      body: {
        content: {
          "application/json": { schema: schemas.listDvdCompareReleasesRequestSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Release packages for the film",
        content: {
          "application/json": { schema: schemas.listDvdCompareReleasesResponseSchema },
        },
      },
    },
  }),
  async (context) => {
    if (isFakeRequest(context)) {
      return context.json(fakeListDvdCompareReleases(), 200)
    }
    const body = context.req.valid("json")
    try {
      const result = await lastValueFrom(listDvdCompareReleases(body.dvdCompareId))
      return context.json({ ...result, error: null }, 200)
    } catch (err) {
      const message = messageFromError(err)
      console.error("[listDvdCompareReleases]", message)
      return context.json({ releases: [], error: message }, 200)
    }
  },
)

queryRoutes.openapi(
  createRoute({
    method: "post",
    path: "/queries/lookupMal",
    summary: "Reverse-lookup a MAL series by ID",
    description: "Used by the builder when the user manually edits the MAL ID — returns the display name.",
    tags: ["Naming Operations"],
    request: {
      body: {
        content: {
          "application/json": { schema: schemas.lookupMalRequestSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Series name (or null if not found)",
        content: {
          "application/json": { schema: schemas.nameLookupResponseSchema },
        },
      },
    },
  }),
  async (context) => {
    if (isFakeRequest(context)) {
      return context.json(fakeNameLookup(), 200)
    }
    const body = context.req.valid("json")
    const result = await lastValueFrom(lookupMalById(body.malId))
    return context.json({ name: result?.name ?? null }, 200)
  },
)

queryRoutes.openapi(
  createRoute({
    method: "post",
    path: "/queries/lookupTvdb",
    summary: "Reverse-lookup a TVDB series by ID",
    description: "Used by the builder when the user manually edits the TVDB ID — returns the series name.",
    tags: ["Naming Operations"],
    request: {
      body: {
        content: {
          "application/json": { schema: schemas.lookupTvdbRequestSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Series name (or null if not found)",
        content: {
          "application/json": { schema: schemas.nameLookupResponseSchema },
        },
      },
    },
  }),
  async (context) => {
    if (isFakeRequest(context)) {
      return context.json(fakeNameLookup(), 200)
    }
    const body = context.req.valid("json")
    const result = await lastValueFrom(lookupTvdbById(body.tvdbId))
    return context.json({ name: result?.name ?? null }, 200)
  },
)

queryRoutes.openapi(
  createRoute({
    method: "post",
    path: "/queries/lookupMovieDb",
    summary: "Reverse-lookup a TMDB film by ID",
    description: "Used by the builder when the user manually edits the TMDB ID — returns the formatted display name 'Title (Year)'.",
    tags: ["Naming Operations"],
    request: {
      body: {
        content: {
          "application/json": { schema: schemas.lookupMovieDbRequestSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Movie display name (or null if not found)",
        content: {
          "application/json": { schema: schemas.nameLookupResponseSchema },
        },
      },
    },
  }),
  async (context) => {
    if (isFakeRequest(context)) {
      return context.json(fakeNameLookup(), 200)
    }
    const body = context.req.valid("json")
    const result = await lastValueFrom(lookupMovieDbById(body.movieDbId))
    return context.json({ name: result?.name ?? null }, 200)
  },
)

queryRoutes.openapi(
  createRoute({
    method: "post",
    path: "/queries/lookupDvdCompare",
    summary: "Reverse-lookup a DVDCompare film by ID",
    description: "Used by the builder when the user manually edits the DVDCompare film ID — returns the formatted display name (with variant + year).",
    tags: ["Naming Operations"],
    request: {
      body: {
        content: {
          "application/json": { schema: schemas.lookupDvdCompareRequestSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Film display name (or null if not found)",
        content: {
          "application/json": { schema: schemas.nameLookupResponseSchema },
        },
      },
    },
  }),
  async (context) => {
    if (isFakeRequest(context)) {
      return context.json(fakeNameLookup(), 200)
    }
    const body = context.req.valid("json")
    const result = await lastValueFrom(lookupDvdCompareFilm(body.dvdCompareId))
    return context.json({ name: result?.name ?? null }, 200)
  },
)

queryRoutes.openapi(
  createRoute({
    method: "post",
    path: "/queries/lookupDvdCompareRelease",
    summary: "Reverse-lookup a DVDCompare release package by film ID + hash",
    description: "Used by the builder when the user manually edits the release hash — returns the release package label.",
    tags: ["Naming Operations"],
    request: {
      body: {
        content: {
          "application/json": { schema: schemas.lookupDvdCompareReleaseRequestSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Release label (or null if not found)",
        content: {
          "application/json": { schema: schemas.labelLookupResponseSchema },
        },
      },
    },
  }),
  async (context) => {
    if (isFakeRequest(context)) {
      return context.json(fakeLabelLookup(), 200)
    }
    const body = context.req.valid("json")
    const result = await lastValueFrom(lookupDvdCompareRelease(body.dvdCompareId, body.hash))
    return context.json({ label: result?.label ?? null }, 200)
  },
)

queryRoutes.openapi(
  createRoute({
    method: "post",
    path: "/queries/listDirectoryEntries",
    summary: "List entries in a directory (typeahead for path fields)",
    description: "Returns the directory entries at `path`. If `path` is a file, lists its parent directory instead. Used by the builder UI to autocomplete path inputs as the user types.",
    tags: ["File Operations"],
    request: {
      body: {
        content: {
          "application/json": { schema: schemas.listDirectoryEntriesRequestSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Directory entries (or an error message if the listing failed)",
        content: {
          "application/json": { schema: schemas.listDirectoryEntriesResponseSchema },
        },
      },
    },
  }),
  async (context) => {
    if (isFakeRequest(context)) {
      return context.json(fakeListDirectoryEntries(), 200)
    }
    const body = context.req.valid("json")
    try {
      const result = await lastValueFrom(listDirectoryEntries(body.path))
      return context.json({ ...result, error: null }, 200)
    } catch (err) {
      const message = messageFromError(err)
      console.error("[listDirectoryEntries]", message)
      // Fall back to the OS native separator even on error so the client
      // can still build sensible paths if it retries.
      return context.json({ entries: [], separator: pathSeparator, error: message }, 200)
    }
  },
)
