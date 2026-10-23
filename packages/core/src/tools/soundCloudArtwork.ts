import { logAndRethrowPipelineError } from "@mux-magic/tools"
import { from, type Observable } from "rxjs"

import { normaliseForComparison } from "./itunesArtwork.js"
import type { CachedFetch } from "./musicBrainzApi.js"

// SoundCloud, reached by a KNOWN PAGE URL through its public oEmbed endpoint.
//
// The SoundCloud API needs a registered client id, and registration is
// closed. Borrowing the id the web player carries, logging in, or sending a
// browser's user agent would all be working around the terms, so this
// provider does none of them. oEmbed is the one public route: it takes a
// track or playlist URL and answers with the title, the uploader and a
// thumbnail. It cannot search, so neither can this provider — the caller
// has to know the page.
export const SOUNDCLOUD_OEMBED_BASE_URL =
  "https://soundcloud.com/oembed"

// oEmbed hands back `-t500x500.jpg`, and every sized variant is served from
// the same path with a different suffix. Measured 2026-10-23:
//
// - `-original.<ext>` is the uploaded file, but its extension is whatever
//   was uploaded. Of 42 tracks across seven artists, 29 answered only at
//   `.jpg` and 13 only at `.png`, and oEmbed does not say which. Guessing
//   wrong is a 404, and probing both doubles the requests.
// - `-t3000x3000` and `-t1080x1080` always answer, but they are UPSCALED: a
//   600 x 600 original came back as a 3000 x 3000 JPEG. A bigger file of
//   the same pixels is not a better cover.
//
// So the size is `t500x500`, the largest one that is reliably present and
// not inflated past what most uploads hold. Any other suffix oEmbed might
// return (`-large`, which is 100 x 100, `-crop`, `-t300x300`) is moved to it.
export const SOUNDCLOUD_ARTWORK_SIZE = "t500x500"

export type SoundCloudArtworkImage = {
  authorName: string
  imageUrl: string
  pageUrl: string
  title: string
}

export type SoundCloudOembedResponse = {
  author_name?: string
  thumbnail_url?: string
  title?: string
}

export const buildSoundCloudOembedUrl = (pageUrl: string) =>
  `${SOUNDCLOUD_OEMBED_BASE_URL}?${new URLSearchParams({
    format: "json",
    url: pageUrl,
  }).toString()}`

// Only a SoundCloud page is sent to SoundCloud. Anything else would be a
// wasted request at best, and at worst a URL the caller never meant to
// share with a third party.
export const getIsSoundCloudPageUrl = (pageUrl: string) =>
  URL.canParse(pageUrl) &&
  ((url: URL) =>
    url.protocol === "https:" &&
    (url.hostname === "soundcloud.com" ||
      url.hostname.endsWith(".soundcloud.com")))(
    new URL(pageUrl),
  )

// The thumbnail is cover art only when it is an `/artworks-` image. Two
// other things arrive in the same field, and neither is the song's cover:
//
// - A track or playlist with no artwork of its own gets SoundCloud's grey
//   `https://soundcloud.com/images/fb_placeholder.png`. (The web page's
//   `og:image` falls back to the uploader's avatar instead, but oEmbed does
//   not, as of 2026-10-23.)
// - A profile URL gets the uploader's `/avatars-` image.
//
// An avatar is a photo of the uploader, not the release. Putting it on a
// song is the same "wrong art is worse than none" failure the iTunes match
// guards against, so both are refused and the result is `null`.
export const getIsSoundCloudArtworkUrl = (
  thumbnailUrl: string,
) =>
  /^https:\/\/[a-z0-9]+\.sndcdn\.com\/artworks-[^/]+$/u.test(
    thumbnailUrl,
  )

export const upgradeSoundCloudArtworkUrl = (
  artworkUrl: string,
) =>
  artworkUrl.replace(
    /-(?:large|crop|original|t\d+x\d+)\.(?:jpg|png)$/u,
    `-${SOUNDCLOUD_ARTWORK_SIZE}.jpg`,
  )

// oEmbed writes the title as "<title> by <uploader>", so the uploader's
// name is taken off the end before anything is compared or returned.
export const getSoundCloudTitle = ({
  authorName,
  oembedTitle,
}: {
  authorName: string
  oembedTitle: string
}) =>
  ((suffix: string) =>
    authorName.length > 0 && oembedTitle.endsWith(suffix)
      ? oembedTitle.slice(0, -suffix.length)
      : oembedTitle)(` by ${authorName}`)

// See the comment in itunesArtwork.ts: `normaliseForComparison` keeps only
// `a-z0-9`, so a name written entirely in a non-Latin script normalises to
// the EMPTY STRING, and two empty strings are equal. An empty comparison is
// a missing check, not a match, so it is refused.
const getIsNormalisedEqual = ({
  candidate,
  expected,
}: {
  candidate: string
  expected: string
}) =>
  ((normalisedExpected) =>
    normalisedExpected.length > 0 &&
    normaliseForComparison(candidate) ===
      normalisedExpected)(normaliseForComparison(expected))

// Uploaders often title a track "<uploader> - <title>". The track is
// confirmed when the expected title equals the whole title or the part
// after that leading "<uploader> - ", and nothing looser — a substring test
// would let "Intro" confirm every intro on the account.
export const getComparableSoundCloudTitles = ({
  authorName,
  title,
}: {
  authorName: string
  title: string
}) =>
  ((separatorMatch: RegExpMatchArray | null) =>
    separatorMatch !== null &&
    separatorMatch.index !== undefined &&
    getIsNormalisedEqual({
      candidate: title.slice(0, separatorMatch.index),
      expected: authorName,
    })
      ? [
          title,
          title.slice(
            separatorMatch.index + separatorMatch[0].length,
          ),
        ]
      : [title])(title.match(/\s+[-–—]\s+/u))

export const getIsSoundCloudMatchConfirmed = ({
  artistName,
  authorName,
  title,
  trackTitle,
}: {
  artistName?: string
  authorName: string
  title: string
  trackTitle?: string
}) =>
  (artistName === undefined ||
    getIsNormalisedEqual({
      candidate: authorName,
      expected: artistName,
    })) &&
  (trackTitle === undefined ||
    getComparableSoundCloudTitles({
      authorName,
      title,
    }).some((comparableTitle) =>
      getIsNormalisedEqual({
        candidate: comparableTitle,
        expected: trackTitle,
      }),
    ))

export const selectSoundCloudArtwork = ({
  artistName,
  pageUrl,
  rawResponse,
  trackTitle,
}: {
  artistName?: string
  pageUrl: string
  rawResponse: SoundCloudOembedResponse
  trackTitle?: string
}): SoundCloudArtworkImage | null =>
  ((authorName: string) =>
    ((title: string) =>
      getIsSoundCloudArtworkUrl(
        rawResponse.thumbnail_url ?? "",
      ) &&
      getIsSoundCloudMatchConfirmed({
        artistName,
        authorName,
        title,
        trackTitle,
      })
        ? {
            authorName,
            imageUrl: upgradeSoundCloudArtworkUrl(
              rawResponse.thumbnail_url ?? "",
            ),
            pageUrl,
            title,
          }
        : null)(
      getSoundCloudTitle({
        authorName,
        oembedTitle: rawResponse.title ?? "",
      }),
    ))(rawResponse.author_name ?? "")

// Not part of `resolveCoverArtImage`'s album chain: this reads one page the
// caller already knows, for one song, and has nothing to search an album
// with. See docs/decisions/2026-10-23-soundcloud-artwork-comes-from-oembed-by-page-url.md.
export const getSoundCloudArtwork = ({
  artistName,
  cachedFetch,
  pageUrl,
  trackTitle,
}: {
  artistName?: string
  cachedFetch: CachedFetch
  pageUrl: string
  trackTitle?: string
}): Observable<SoundCloudArtworkImage | null> =>
  from(
    getIsSoundCloudPageUrl(pageUrl)
      ? cachedFetch(buildSoundCloudOembedUrl(pageUrl))
          .then(({ body }) =>
            selectSoundCloudArtwork({
              artistName,
              pageUrl,
              rawResponse: JSON.parse(
                body,
              ) as SoundCloudOembedResponse,
              trackTitle,
            }),
          )
          // A removed track is a 404, a private one a 403, and an
          // unreachable host a transport error. Each leaves the song
          // without SoundCloud art; none of them should stop the caller.
          .catch(() => null)
      : Promise.resolve(null),
  ).pipe(logAndRethrowPipelineError(getSoundCloudArtwork))
