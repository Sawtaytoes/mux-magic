import { logAndRethrowPipelineError } from "@mux-magic/tools"
import { JSDOM } from "jsdom"
import { from, type Observable } from "rxjs"

import { normaliseTitleForIdentifierMatch } from "./discogsArtwork.js"
import type { CachedFetch } from "./musicBrainzApi.js"

// Newgrounds' audio portal, read for a track's submission art. This is a
// SEARCH provider, not a link in the album chain: Newgrounds is a track
// site, many uploads share a title, and the art is often not a cover at all.
//
// ⚠️ Newgrounds sits behind its own browser check, "NG Guard". Measured
// 2026-10-23 from an agent sandbox: every page, robots.txt included,
// answered 403 with a page that runs a JavaScript puzzle and says logged-in
// members skip it. This module does NOT try to pass it — no solver, no
// headless browser, no borrowed browser identity, no login. A guard page is
// "Newgrounds is unavailable", which is `null` here and the provider cache's
// stored answer when it has one. Newgrounds publishes no API for audio
// search.
//
// The page structure the parsers expect was read from archived copies of
// the pages, which is also where the test fixtures come from.
export const NEWGROUNDS_BASE_URL =
  "https://www.newgrounds.com"

// The politeness interval, one request every 3 seconds, is set on
// `newgroundsCachedFetch` in musicProviderFetchers.ts. It is not exported
// from here because that module must not import this one: this one loads
// JSDOM.

// Only the first few results of a search are opened, because every one of
// them is a full listen page request.
export const NEWGROUNDS_MAXIMUM_LISTEN_PAGES = 5

export type NewgroundsArtworkCandidate = {
  authorName: string
  imageUrl: string | null
  // True when the image is the author's user icon rather than art made for
  // this track — an avatar, which a caller should not treat as a cover.
  isArtistIcon: boolean
  pageUrl: string
  title: string
}

type NewgroundsSearchResult = {
  authorName: string
  submissionId: string
  title: string
}

type NewgroundsCreditedUser = {
  iconUrl: string | null
  userName: string
}

// NG Guard, and Cloudflare's challenge in case Newgrounds ever fronts one.
// Both arrive as a 403, which the cached fetch already rejects, but a guard
// body must never be parsed as an empty result list either.
export const getIsNewgroundsChallengePage = (
  body: string,
) =>
  /<title>\s*(?:NG Guard|Just a moment\.\.\.)\s*<\/title>/iu.test(
    body,
  ) || body.includes("/_guard/")

export const buildNewgroundsListenPageUrl = (
  submissionId: string,
) => `${NEWGROUNDS_BASE_URL}/audio/listen/${submissionId}`

export const buildNewgroundsSearchUrl = (
  trackTitle: string,
) =>
  `${NEWGROUNDS_BASE_URL}/search/conduct/audio?${new URLSearchParams(
    { terms: trackTitle },
  ).toString()}`

const extractSubmissionId = (url: string) =>
  url.match(
    /^(?:https?:)?\/\/(?:www\.)?newgrounds\.com\/audio\/listen\/(\d+)/iu,
  )?.[1] ?? ""

const parseDocument = (body: string) =>
  new JSDOM(body).window.document

const readText = (element: Element | null | undefined) =>
  (element?.textContent ?? "").replace(/\s+/gu, " ").trim()

export const parseNewgroundsSearchResults = (
  body: string,
): NewgroundsSearchResult[] =>
  Array.from(
    parseDocument(body).querySelectorAll(
      "a.item-audiosubmission",
    ),
  )
    .map((anchor) => ({
      authorName: readText(
        anchor.querySelector(".detail-title strong"),
      ),
      submissionId: extractSubmissionId(
        anchor.getAttribute("href") ?? "",
      ),
      // `.detail-title h4` rather than the `title` attribute, which older
      // result pages do not carry. The search's highlight marks are inline,
      // so the text is the plain title.
      title: readText(
        anchor.querySelector(".detail-title h4"),
      ),
    }))
    .filter(
      (searchResult) =>
        searchResult.submissionId.length > 0 &&
        searchResult.title.length > 0,
    )

// Art made for the track lives on `aicon.ngfiles.com`. A user's icon lives
// on `uimg.ngfiles.com/icons/`. A track with no art of its own shows
// Newgrounds' generic audio icon from `img.ngfiles.com/defaults/`, or no
// `og:image` at all.
const getIsSubmissionArtUrl = (imageUrl: string) =>
  /^https?:\/\/aicon\.ngfiles\.com\//iu.test(imageUrl)

const getIsUserIconUrl = (imageUrl: string) =>
  /^https?:\/\/uimg\.ngfiles\.com\/icons\//iu.test(imageUrl)

const readCreditedUsers = (
  document: Document,
): NewgroundsCreditedUser[] =>
  Array.from(document.querySelectorAll(".item-user")).map(
    (userElement) => ({
      iconUrl:
        userElement
          .querySelector(".item-icon image")
          ?.getAttribute("href") ?? null,
      userName: readText(
        userElement.querySelector(
          ".item-details-main h4 a",
        ),
      ),
    }),
  )

const getIsSameName = ({
  candidate,
  expected,
}: {
  candidate: string
  expected: string
}) =>
  ((normalisedExpected) =>
    normalisedExpected.length > 0 &&
    normaliseTitleForIdentifierMatch(candidate) ===
      normalisedExpected)(
    normaliseTitleForIdentifierMatch(expected),
  )

// The submission's own art when it has some. Without it, the author's user
// icon stands in — flagged, because an avatar is not a cover and a caller
// must be able to tell.
const selectImage = ({
  authorName,
  creditedUsers,
  openGraphImageUrl,
}: {
  authorName: string
  creditedUsers: NewgroundsCreditedUser[]
  openGraphImageUrl: string | null
}) =>
  openGraphImageUrl !== null &&
  getIsSubmissionArtUrl(openGraphImageUrl)
    ? { imageUrl: openGraphImageUrl, isArtistIcon: false }
    : openGraphImageUrl !== null &&
        getIsUserIconUrl(openGraphImageUrl)
      ? { imageUrl: openGraphImageUrl, isArtistIcon: true }
      : ((authorIconUrl) =>
          authorIconUrl === null
            ? { imageUrl: null, isArtistIcon: false }
            : {
                imageUrl: authorIconUrl,
                isArtistIcon: true,
              })(
          creditedUsers
            .filter(
              (creditedUser) =>
                creditedUser.iconUrl !== null &&
                getIsUserIconUrl(creditedUser.iconUrl) &&
                getIsSameName({
                  candidate: creditedUser.userName,
                  expected: authorName,
                }),
            )
            .map((creditedUser) => creditedUser.iconUrl)
            .at(0) ?? null,
        )

// `null` for anything that is not a listen page — a guard page, a search
// page, an error page — so a caller never builds a candidate out of one.
// The search result supplies the author, because a listen page credits
// every collaborator and does not mark which one uploaded it.
export const parseNewgroundsListenPage = ({
  authorName,
  body,
}: {
  authorName: string
  body: string
}): NewgroundsArtworkCandidate | null =>
  getIsNewgroundsChallengePage(body)
    ? null
    : ((document) =>
        ((submissionId, title) =>
          submissionId.length === 0 || title.length === 0
            ? null
            : {
                authorName,
                ...selectImage({
                  authorName,
                  creditedUsers:
                    readCreditedUsers(document),
                  openGraphImageUrl:
                    document
                      .querySelector(
                        'meta[property="og:image"]',
                      )
                      ?.getAttribute("content") ?? null,
                }),
                pageUrl:
                  buildNewgroundsListenPageUrl(
                    submissionId,
                  ),
                title,
              })(
          extractSubmissionId(
            document
              .querySelector('meta[property="og:url"]')
              ?.getAttribute("content") ?? "",
          ),
          readText(
            document.querySelector('h2[itemprop="name"]'),
          ) ||
            (document
              .querySelector('meta[property="og:title"]')
              ?.getAttribute("content") ??
              ""),
        ))(parseDocument(body))

// Older uploads put the author in front of the title — "ParagonX9 - Chaoz
// Fantasy" by ParagonX9. That prefix, and only when it is the author's own
// name, is dropped for the comparison; anything else in the title still has
// to match.
const getComparableTitles = ({
  authorName,
  title,
}: {
  authorName: string
  title: string
}) =>
  ((authorPrefixMatch) =>
    authorPrefixMatch !== null &&
    getIsSameName({
      candidate: authorPrefixMatch[1],
      expected: authorName,
    })
      ? [title, authorPrefixMatch[2]]
      : [title])(title.match(/^(.+?)\s+[-–]\s+(.+)$/u))

// Strict on both, as every search provider here is: equal once case,
// spacing and punctuation are removed, in any script. A name that
// normalises to nothing is a missing check, never a match.
export const getIsNewgroundsMatch = ({
  artistName,
  authorName,
  title,
  trackTitle,
}: {
  artistName: string
  authorName: string
  title: string
  trackTitle: string
}) =>
  getIsSameName({
    candidate: authorName,
    expected: artistName,
  }) &&
  getComparableTitles({ authorName, title }).some(
    (comparableTitle) =>
      getIsSameName({
        candidate: comparableTitle,
        expected: trackTitle,
      }),
  )

const fetchListenPage = ({
  cachedFetch,
  searchResult,
}: {
  cachedFetch: CachedFetch
  searchResult: NewgroundsSearchResult
}) =>
  cachedFetch(
    buildNewgroundsListenPageUrl(searchResult.submissionId),
  )
    .then(({ body }) =>
      parseNewgroundsListenPage({
        authorName: searchResult.authorName,
        body,
      }),
    )
    // One unreadable listen page drops that track, not the whole search.
    .catch(() => null)

// One page at a time, so a match can stop the walk before the remaining
// pages are asked for.
const findListenPages = ({
  cachedFetch,
  getIsFinished,
  searchResults,
}: {
  cachedFetch: CachedFetch
  getIsFinished: (
    candidates: NewgroundsArtworkCandidate[],
  ) => boolean
  searchResults: NewgroundsSearchResult[]
}) =>
  searchResults
    .slice(0, NEWGROUNDS_MAXIMUM_LISTEN_PAGES)
    .reduce(
      (
        candidatesSoFar: Promise<
          NewgroundsArtworkCandidate[]
        >,
        searchResult,
      ) =>
        candidatesSoFar.then((candidates) =>
          getIsFinished(candidates)
            ? candidates
            : fetchListenPage({
                cachedFetch,
                searchResult,
              }).then((candidate) =>
                candidate === null
                  ? candidates
                  : candidates.concat(candidate),
              ),
        ),
      Promise.resolve<NewgroundsArtworkCandidate[]>([]),
    )

// The search is on the track title alone, and the author is compared
// against each result's credited uploader instead. A title search is what
// the archived result pages show working; adding the author's name only
// adds a word every result has to contain.
const searchListenPages = ({
  artistName,
  cachedFetch,
  getIsFinished,
  getIsSearchResultWanted,
  trackTitle,
}: {
  artistName: string
  cachedFetch: CachedFetch
  getIsFinished: (
    candidates: NewgroundsArtworkCandidate[],
  ) => boolean
  getIsSearchResultWanted: (
    searchResult: NewgroundsSearchResult,
  ) => boolean
  trackTitle: string
}) =>
  trackTitle.trim().length === 0 ||
  artistName.trim().length === 0
    ? Promise.resolve<NewgroundsArtworkCandidate[]>([])
    : cachedFetch(buildNewgroundsSearchUrl(trackTitle))
        .then(({ body }) =>
          getIsNewgroundsChallengePage(body)
            ? []
            : findListenPages({
                cachedFetch,
                getIsFinished,
                searchResults: parseNewgroundsSearchResults(
                  body,
                ).filter(getIsSearchResultWanted),
              }),
        )
        // A 403 guard page, a 404, a timeout: Newgrounds is unavailable,
        // and an unavailable search provider reports nothing rather than
        // failing the caller.
        .catch(() => [])

const getIsCandidateMatch = ({
  artistName,
  candidate,
  trackTitle,
}: {
  artistName: string
  candidate: NewgroundsArtworkCandidate
  trackTitle: string
}) =>
  getIsNewgroundsMatch({
    artistName,
    authorName: candidate.authorName,
    title: candidate.title,
    trackTitle,
  })

export const searchNewgroundsArtworkCandidates = ({
  artistName,
  cachedFetch,
  trackTitle,
}: {
  artistName: string
  cachedFetch: CachedFetch
  trackTitle: string
}): Observable<NewgroundsArtworkCandidate[]> =>
  from(
    searchListenPages({
      artistName,
      cachedFetch,
      getIsFinished: () => false,
      getIsSearchResultWanted: () => true,
      trackTitle,
    }).then((candidates) =>
      // The candidates that match the author and title come first, but a
      // search keeps every track it read so a person can still pick one.
      candidates
        .filter((candidate) =>
          getIsCandidateMatch({
            artistName,
            candidate,
            trackTitle,
          }),
        )
        .concat(
          candidates.filter(
            (candidate) =>
              !getIsCandidateMatch({
                artistName,
                candidate,
                trackTitle,
              }),
          ),
        ),
    ),
  ).pipe(
    logAndRethrowPipelineError(
      searchNewgroundsArtworkCandidates,
    ),
  )

// Track art is preferred over an author's icon, and an icon over nothing.
const selectBestMatch = ({
  artistName,
  candidates,
  trackTitle,
}: {
  artistName: string
  candidates: NewgroundsArtworkCandidate[]
  trackTitle: string
}) =>
  ((matchedCandidates) =>
    matchedCandidates.find(
      (candidate) => !candidate.isArtistIcon,
    ) ??
    matchedCandidates.at(0) ??
    null)(
    candidates.filter(
      (candidate) =>
        candidate.imageUrl !== null &&
        getIsCandidateMatch({
          artistName,
          candidate,
          trackTitle,
        }),
    ),
  )

// The track whose author and title are both equal to the ones asked for and
// that has an image. Search results whose author or title do not match are
// never opened. The result can be the author's icon; `isArtistIcon` says so.
export const getNewgroundsArtwork = ({
  artistName,
  cachedFetch,
  trackTitle,
}: {
  artistName: string
  cachedFetch: CachedFetch
  trackTitle: string
}): Observable<NewgroundsArtworkCandidate | null> =>
  from(
    searchListenPages({
      artistName,
      cachedFetch,
      getIsFinished: (candidates) =>
        candidates.some(
          (candidate) =>
            candidate.imageUrl !== null &&
            !candidate.isArtistIcon &&
            getIsCandidateMatch({
              artistName,
              candidate,
              trackTitle,
            }),
        ),
      getIsSearchResultWanted: (searchResult) =>
        getIsNewgroundsMatch({
          artistName,
          authorName: searchResult.authorName,
          title: searchResult.title,
          trackTitle,
        }),
      trackTitle,
    }).then((candidates) =>
      selectBestMatch({
        artistName,
        candidates,
        trackTitle,
      }),
    ),
  ).pipe(logAndRethrowPipelineError(getNewgroundsArtwork))
