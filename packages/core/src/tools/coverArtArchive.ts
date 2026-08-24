import { logAndRethrowPipelineError } from "@mux-magic/tools"
import { from, type Observable, of, switchMap } from "rxjs"

import type { CachedFetch } from "./musicBrainzApi.js"

export const COVER_ART_ARCHIVE_BASE_URL =
  "https://coverartarchive.org"

// Picard saves the art beside the files as `cover.<ext>`.
export const COVER_ART_FILENAME = "cover"

// Picard's `local_files_pattern`, used to find art already on disk. The `i`
// flag is ours: the library is read over SMB from Windows, where `Folder.jpg`
// and `Cover.jpg` are the common spellings.
export const LOCAL_COVER_ART_PATTERN =
  /^(?:cover|folder|albumart)(.*)\.(?:jpe?g|png|gif|tiff?|webp)$/iu

// `caa_image_size = -1` — the original upload, not a thumbnail.
export const COVER_ART_ORIGINAL_IMAGE_SIZE = -1

// `caa_restrict_image_types = true` keeps us to the front cover.
export const COVER_ART_FRONT_TYPE = "Front"

// Never requested, at any size.
export const EXCLUDED_COVER_ART_TYPES = [
  "matrix/runout",
  "raw/unedited",
  "watermark",
]

// `approved-only` is false: an unapproved image is still the front cover.
export const isUnapprovedCoverArtAllowedByDefault = true

export const COVER_ART_PROVIDER_ORDER = [
  "release",
  "release-group",
  "theaudiodb",
  "local-files",
]

export type CoverArtProvider = "release" | "release-group"

export type CoverArtImage = {
  coverArtId: string
  imageUrl: string
  isApproved: boolean
  provider: CoverArtProvider
  types: string[]
}

export type CoverArtArchiveRawImage = {
  id?: string | number
  // eslint-disable-next-line @typescript-eslint/naming-convention -- wire field name, as the Cover Art Archive spells it
  front?: boolean
  // eslint-disable-next-line @typescript-eslint/naming-convention -- wire field name, as the Cover Art Archive spells it
  approved?: boolean
  types?: string[]
  image?: string
}

export type CoverArtArchiveRawIndex = {
  images?: CoverArtArchiveRawImage[]
}

// A 404 from the Cover Art Archive means "this release has no art", which is a
// normal outcome and not a failure. Every other status is a real error.
export const getIsCoverArtNotFoundError = (
  error: unknown,
) =>
  error instanceof Error &&
  /\b404\b|not found/iu.test(error.message)

const getIsExcludedType = (types: string[]) =>
  types.some((type) =>
    EXCLUDED_COVER_ART_TYPES.includes(
      type.trim().toLowerCase(),
    ),
  )

export const selectFrontCoverArt = ({
  isUnapprovedCoverArtAllowed = isUnapprovedCoverArtAllowedByDefault,
  provider,
  rawIndex,
}: {
  isUnapprovedCoverArtAllowed?: boolean
  provider: CoverArtProvider
  rawIndex: CoverArtArchiveRawIndex
}): CoverArtImage | null =>
  (rawIndex.images ?? [])
    .map((rawImage) => ({
      coverArtId: String(rawImage.id ?? ""),
      imageUrl: rawImage.image ?? "",
      isApproved: rawImage.approved === true,
      isFront:
        rawImage.front === true ||
        (rawImage.types ?? []).includes(
          COVER_ART_FRONT_TYPE,
        ),
      provider,
      types: rawImage.types ?? [],
    }))
    .filter(
      (image) =>
        image.isFront &&
        image.imageUrl.length > 0 &&
        !getIsExcludedType(image.types) &&
        (isUnapprovedCoverArtAllowed || image.isApproved),
    )
    .map(
      ({
        coverArtId,
        imageUrl,
        isApproved,
        types,
      }): CoverArtImage => ({
        coverArtId,
        imageUrl,
        isApproved,
        provider,
        types,
      }),
    )
    .at(0) ?? null

const fetchCoverArtIndex = ({
  cachedFetch,
  isUnapprovedCoverArtAllowed,
  path,
  provider,
}: {
  cachedFetch: CachedFetch
  isUnapprovedCoverArtAllowed: boolean
  path: string
  provider: CoverArtProvider
}) =>
  cachedFetch(`${COVER_ART_ARCHIVE_BASE_URL}${path}`)
    .then(({ body }) =>
      selectFrontCoverArt({
        isUnapprovedCoverArtAllowed,
        provider,
        rawIndex: JSON.parse(
          body,
        ) as CoverArtArchiveRawIndex,
      }),
    )
    .catch((error: unknown) =>
      getIsCoverArtNotFoundError(error)
        ? null
        : Promise.reject(
            error instanceof Error
              ? error
              : new Error(String(error)),
          ),
    )

// Provider order, per the Picard config: Cover Art Archive release first, then
// the release group. TheAudioDB and local files are the next two providers in
// `COVER_ART_PROVIDER_ORDER` and are a later phase — see the two seams below.
export const getCoverArt = ({
  cachedFetch,
  isUnapprovedCoverArtAllowed = isUnapprovedCoverArtAllowedByDefault,
  releaseGroupId,
  releaseId,
}: {
  cachedFetch: CachedFetch
  isUnapprovedCoverArtAllowed?: boolean
  releaseGroupId?: string
  releaseId?: string
}): Observable<CoverArtImage | null> =>
  from(
    releaseId
      ? fetchCoverArtIndex({
          cachedFetch,
          isUnapprovedCoverArtAllowed,
          path: `/release/${encodeURIComponent(releaseId)}`,
          provider: "release",
        })
      : Promise.resolve(null),
  ).pipe(
    switchMap((releaseImage) =>
      releaseImage || !releaseGroupId
        ? of(releaseImage)
        : from(
            fetchCoverArtIndex({
              cachedFetch,
              isUnapprovedCoverArtAllowed,
              path: `/release-group/${encodeURIComponent(
                releaseGroupId,
              )}`,
              provider: "release-group",
            }),
          ),
    ),
    logAndRethrowPipelineError(getCoverArt),
  )

// Seam, deliberately unimplemented. Picard's provider list has TheAudioDB
// third; building it is a later phase. It throws rather than returning null so
// a call site that wires it up early fails loudly instead of silently
// reporting "this album has no cover art".
export const getTheAudioDbCoverArt = () => {
  throw new Error(
    "TheAudioDB cover art is not implemented. It is the third provider in COVER_ART_PROVIDER_ORDER and belongs to a later phase.",
  )
}

// Seam, deliberately unimplemented. Fourth provider: art already sitting in the
// album folder, matched with LOCAL_COVER_ART_PATTERN.
export const getLocalCoverArt = () => {
  throw new Error(
    "Local cover-art discovery is not implemented. It is the fourth provider in COVER_ART_PROVIDER_ORDER and belongs to a later phase.",
  )
}
