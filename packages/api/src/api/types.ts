// Pure runtime job/event types live in core. Re-exported here so the web's
// `@mux-magic/api/api-types` (later `@mux-magic/api/api-types`) entry
// continues to surface one type module.
export type {
  Job,
  JobLogDoneEvent,
  JobLogLineEvent,
  JobLogsEvent,
  JobStatus,
  JobWire,
  ProgressEvent,
  PromptEvent,
  PromptOption,
  StepEvent,
} from "@mux-magic/core/src/api/types.js"

export type {
  DvdCompareRelease,
  DvdCompareResult,
  DvdCompareVariant,
} from "@mux-magic/core/src/tools/searchDvdCompare.js"

import type { z } from "@hono/zod-openapi"
import type * as schemas from "./schemas.js"
import type {
  directoryEntrySchema,
  fileExplorerEntrySchema,
} from "./schemas.js"

export type DirEntry = ReturnType<
  (typeof directoryEntrySchema)["parse"]
>
export type FileEntry = ReturnType<
  (typeof fileExplorerEntrySchema)["parse"]
>

// Response shapes for the API endpoints web calls. Derived from the same
// Zod schemas the server uses for validation so any server-side change is
// observed by web typecheck instead of slipping through inline `as` casts.
export type CreateJobResponse = z.infer<
  ReturnType<typeof schemas.createJobResponseSchema>
>
export type ListDirectoryEntriesResponse = z.infer<
  typeof schemas.listDirectoryEntriesResponseSchema
>
export type ListFilesResponse = z.infer<
  typeof schemas.listFilesResponseSchema
>
export type SearchMalResponse = z.infer<
  typeof schemas.searchMalResponseSchema
>
export type SearchAnidbResponse = z.infer<
  typeof schemas.searchAnidbResponseSchema
>
export type SearchTvdbResponse = z.infer<
  typeof schemas.searchTvdbResponseSchema
>
export type SearchMovieDbResponse = z.infer<
  typeof schemas.searchMovieDbResponseSchema
>
export type SearchDvdCompareResponse = z.infer<
  typeof schemas.searchDvdCompareResponseSchema
>
export type ListDvdCompareReleasesResponse = z.infer<
  typeof schemas.listDvdCompareReleasesResponseSchema
>
export type LookupMalRequest = z.infer<
  typeof schemas.lookupMalRequestSchema
>
export type LookupAnidbRequest = z.infer<
  typeof schemas.lookupAnidbRequestSchema
>
export type LookupTvdbRequest = z.infer<
  typeof schemas.lookupTvdbRequestSchema
>
export type LookupMovieDbRequest = z.infer<
  typeof schemas.lookupMovieDbRequestSchema
>
export type LookupDvdCompareRequest = z.infer<
  typeof schemas.lookupDvdCompareRequestSchema
>
export type LookupDvdCompareReleaseRequest = z.infer<
  typeof schemas.lookupDvdCompareReleaseRequestSchema
>
export type NameLookupResponse = z.infer<
  typeof schemas.nameLookupResponseSchema
>
export type LabelLookupResponse = z.infer<
  typeof schemas.labelLookupResponseSchema
>
export type DeleteModeResponse = z.infer<
  typeof schemas.deleteModeResponseSchema
>
export type DeleteFilesResponse = z.infer<
  typeof schemas.deleteFilesResponseSchema
>

// ─── Lookup-picker canonical types (consumed by web LookupModal) ─────────────
// The web's LookupModal needs a single union spanning all per-provider search
// results plus the picker's enum of provider keys. Defining these here keeps
// the type-vs-wire contract verifiable on the server; web imports as-is.

export const LOOKUP_TYPES = [
  "mal",
  "anidb",
  "tvdb",
  "tmdb",
  "dvdcompare",
] as const
export type LookupType = (typeof LOOKUP_TYPES)[number]

// Per-provider search-result item types. SearchDvdCompareResult is aliased to
// the existing DvdCompareResult (same shape, both schema-inferred and
// tool-emitted) so callers can use the consistent Search*Result naming.
export type SearchMalResult =
  SearchMalResponse["results"][number]
export type SearchAnidbResult =
  SearchAnidbResponse["results"][number]
export type SearchTvdbResult =
  SearchTvdbResponse["results"][number]
export type SearchMovieDbResult =
  SearchMovieDbResponse["results"][number]
export type SearchDvdCompareResult =
  SearchDvdCompareResponse["results"][number]

// Union of every per-provider search result. Discriminable structurally:
// each branch has a distinguishing required field (malId / aid / tvdbId /
// movieDbId / id+baseTitle for DVDCompare). Web picker code narrows by
// checking which key is present.
export type LookupSearchResult =
  | SearchMalResult
  | SearchAnidbResult
  | SearchTvdbResult
  | SearchMovieDbResult
  | SearchDvdCompareResult

// Release row from listDvdCompareReleases — shape lives on the tool, this
// alias keeps the picker-stage naming aligned with the other Lookup* types.
export type LookupRelease = z.infer<
  typeof schemas.dvdCompareReleaseSchema
>
