import { logAndRethrowPipelineError } from "@mux-magic/tools"
import { JSDOM } from "jsdom"
import { from, type Observable } from "rxjs"

import { extractVgmdbAlbumId } from "./cddbApi.js"
import { normaliseTitleForIdentifierMatch } from "./discogsArtwork.js"
import type { CachedFetch } from "./musicBrainzApi.js"

// VGMdb's web pages, read for their cover art. This is a SEARCH provider,
// not a link in the album chain: a title search can find a different album
// of the same name, so a caller offers these candidates to a person or
// applies one only after the strict match below.
//
// ⚠️ VGMdb sits behind a Cloudflare managed challenge. Measured 2026-10-23
// from an agent sandbox: every page, robots.txt included, answered 403 with
// `cf-mitigated: challenge`, under a descriptive User-Agent and a browser
// one alike. This module does NOT try to pass the challenge — no solver, no
// headless browser, no borrowed browser identity. A challenge is "VGMdb is
// unavailable", which is `null` here and the provider cache's stored answer
// when it has one. There is no official VGMdb API, and the community JSON
// mirror at vgmdb.info did not answer. The freedb emulator in cddbApi.ts is
// a separate surface that matches by disc table of contents, not by title.
//
// The page structure the parsers expect was read from archived copies of
// the pages, which is also where the test fixtures come from.
export const VGMDB_BASE_URL = "https://vgmdb.net"

// The politeness interval, one request every 3 seconds, is set on
// `vgmdbCachedFetch` in musicProviderFetchers.ts. It is not exported from
// here because that module must not import this one: this one loads JSDOM.

// A title search can list a thousand albums. Only the first few are read,
// because every one of them is a full album page request.
export const VGMDB_MAXIMUM_ALBUM_PAGES = 5

export type VgmdbArtworkCandidate = {
  albumTitle: string
  artistNames: string[]
  imageUrl: string | null
  pageUrl: string
}

// A VGMdb album carries its title in up to three languages (English,
// Japanese and its romanization) and every credited person in two. The
// candidate shows one of each; the match compares against all of them.
type VgmdbAlbumPage = {
  albumTitleVariants: string[]
  artistNameVariants: string[]
  candidate: VgmdbArtworkCandidate
}

type VgmdbSearchResult = {
  albumId: string
  albumTitleVariants: string[]
}

// Only the credits that name the music's makers. An album page also credits
// its mastering engineer, its designer and its sales promotion, and an
// album is not "by" any of them. VGMdb's role names are free text, so this
// is a word list: the writing roles, the performing roles, and the common
// instruments. "Singer" rather than "sing", which would also match
// "Supervising"; "Artist" but not "Artist Manager".
const MUSICAL_ROLE_PATTERN =
  /compos|arrang|music|perform|vocal|singer|band|orchestr|conduct|remix|lyric|piano|guitar|bass|drum|violin|viola|cello|string|flute|oboe|clarinet|horn|trombone|trumpet|percussion|harp|soprano|alto|tenor|voice|chorus|choir|\bartists?\b(?!\s+manag)|作曲|編曲|作詞|歌|演奏/iu

// Cloudflare's managed challenge. It arrives as a 403, which the cached
// fetch already rejects, but a challenge body must never be parsed as an
// empty result list either.
export const getIsVgmdbChallengePage = (body: string) =>
  /<title>\s*Just a moment\.\.\.\s*<\/title>/iu.test(
    body,
  ) || body.includes("challenges.cloudflare.com")

// `medium-media.vgm.io` is the 250 pixel image the page shows and
// `thumb-media.vgm.io` is the gallery thumbnail. `media.vgm.io` serves the
// same path at its original size.
export const upgradeVgmdbImageUrl = (imageUrl: string) =>
  imageUrl.replace(
    /^(?:https?:)?\/\/(?:medium-|thumb-)?media\.vgm\.io\//iu,
    "https://media.vgm.io/",
  )

const getIsVgmdbMediaUrl = (imageUrl: string) =>
  /^(?:https?:)?\/\/(?:medium-|thumb-)?media\.vgm\.io\//iu.test(
    imageUrl,
  )

export const buildVgmdbAlbumPageUrl = (albumId: string) =>
  `${VGMDB_BASE_URL}/album/${albumId}`

export const buildVgmdbSearchUrl = (albumTitle: string) =>
  `${VGMDB_BASE_URL}/search?${new URLSearchParams({
    q: albumTitle,
  }).toString()}`

const parseDocument = (body: string) =>
  new JSDOM(body).window.document

const getUniqueNonEmpty = (values: string[]) =>
  Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  )

// Each language's title is its own `span.albumtitle`, and every one after
// the first opens with an `<em> / </em>` separator inside the span.
const readAlbumTitleVariants = (parent: Element) =>
  getUniqueNonEmpty(
    Array.from(
      parent.querySelectorAll("span.albumtitle"),
    ).map((span) =>
      (span.textContent ?? "").replace(/^\s*\/\s*/u, ""),
    ),
  )

export const parseVgmdbSearchResults = (
  body: string,
): VgmdbSearchResult[] =>
  Array.from(
    parseDocument(body).querySelectorAll(
      "#albumresults a.albumtitle",
    ),
  )
    .map((anchor) => ({
      albumId: extractVgmdbAlbumId(
        anchor.getAttribute("href") ?? "",
      ),
      albumTitleVariants: readAlbumTitleVariants(anchor),
    }))
    .filter(
      (searchResult) =>
        searchResult.albumId.length > 0 &&
        searchResult.albumTitleVariants.length > 0,
    )

// The cover is a CSS background on `#coverart`. `og:image` carries the same
// file and is the fallback. An album with no scan shows a placeholder from
// VGMdb's own `/db/img/` path, which is not a cover.
const readCoverImageUrl = (document: Document) =>
  ((imageUrl) =>
    imageUrl !== null && getIsVgmdbMediaUrl(imageUrl)
      ? upgradeVgmdbImageUrl(imageUrl)
      : null)(
    (
      document
        .querySelector("#coverart")
        ?.getAttribute("style")
        ?.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/u) ?? []
    ).at(1) ??
      document
        .querySelector('meta[property="og:image"]')
        ?.getAttribute("content") ??
      null,
  )

const readNameVariantsFromAnchor = (anchor: Element) =>
  ((nameSpans) =>
    nameSpans.length === 0
      ? {
          displayName: (anchor.textContent ?? "").trim(),
          nameVariants: [anchor.textContent ?? ""],
        }
      : {
          displayName: (
            (
              nameSpans.find(
                (span) =>
                  span.getAttribute("lang") === "en",
              ) ?? nameSpans[0]
            ).textContent ?? ""
          ).trim(),
          nameVariants: nameSpans.flatMap((span) => [
            span.textContent ?? "",
            span.getAttribute("title") ?? "",
          ]),
        })(
    Array.from(anchor.querySelectorAll("span.artistname")),
  )

// A credit cell mixes linked artists with plain comma-separated names for
// people VGMdb has no artist page for. A bracketed fragment on its own is
// the group a linked artist performed with — "Tsutomu Narita (SMILE
// PLEASE)" — and is a note on the name before it, not another name.
const readCreditedNames = (creditCell: Element) =>
  Array.from(creditCell.childNodes).flatMap((childNode) =>
    childNode.nodeName === "A"
      ? [readNameVariantsFromAnchor(childNode as Element)]
      : childNode.nodeName === "#text"
        ? (childNode.textContent ?? "")
            .split(",")
            .map((name) => name.trim())
            .filter(
              (name) =>
                name.length > 0 && !/^\(.*\)$/u.test(name),
            )
            .map((name) => ({
              displayName: name,
              nameVariants: [name],
            }))
        : [],
  )

const readMusicalCredits = (document: Document) =>
  Array.from(
    document.querySelectorAll("#collapse_credits tr"),
  )
    .filter((creditRow) =>
      MUSICAL_ROLE_PATTERN.test(
        creditRow.querySelector("td")?.textContent ?? "",
      ),
    )
    .flatMap((creditRow) =>
      ((creditCell) =>
        creditCell === null
          ? []
          : readCreditedNames(creditCell))(
        creditRow.querySelector("td:nth-child(2)"),
      ),
    )

const readCanonicalAlbumId = (document: Document) =>
  extractVgmdbAlbumId(
    document
      .querySelector('link[rel="canonical"]')
      ?.getAttribute("href") ??
      document
        .querySelector('meta[property="og:url"]')
        ?.getAttribute("content") ??
      "",
  )

// `null` for anything that is not an album page — a challenge, a search
// page, an error page — so a caller never builds a candidate out of one.
export const parseVgmdbAlbumPage = (
  body: string,
): VgmdbAlbumPage | null =>
  getIsVgmdbChallengePage(body)
    ? null
    : ((document) =>
        ((albumId, albumTitleVariants, credits) =>
          albumId.length === 0 ||
          albumTitleVariants.length === 0
            ? null
            : {
                albumTitleVariants,
                artistNameVariants: getUniqueNonEmpty(
                  credits.flatMap(
                    (credit) => credit.nameVariants,
                  ),
                ),
                candidate: {
                  albumTitle: albumTitleVariants[0],
                  artistNames: getUniqueNonEmpty(
                    credits.map(
                      (credit) => credit.displayName,
                    ),
                  ),
                  imageUrl: readCoverImageUrl(document),
                  pageUrl: buildVgmdbAlbumPageUrl(albumId),
                },
              })(
          readCanonicalAlbumId(document),
          ((heading) =>
            heading === null
              ? []
              : readAlbumTitleVariants(heading))(
            document.querySelector("h1"),
          ),
          readMusicalCredits(document),
        ))(parseDocument(body))

// Strict, as every search provider here is: equal once case, spacing and
// punctuation are removed, in any script. A string that normalises to
// nothing is a missing check, never a match.
const getIsAnyVariantEqual = ({
  expected,
  variants,
}: {
  expected: string
  variants: string[]
}) =>
  ((normalisedExpected) =>
    normalisedExpected.length > 0 &&
    variants.some(
      (variant) =>
        normaliseTitleForIdentifierMatch(variant) ===
        normalisedExpected,
    ))(normaliseTitleForIdentifierMatch(expected))

export const getIsVgmdbAlbumMatch = ({
  albumPage,
  albumTitle,
  artistName,
}: {
  albumPage: VgmdbAlbumPage
  albumTitle: string
  artistName?: string
}) =>
  getIsAnyVariantEqual({
    expected: albumTitle,
    variants: albumPage.albumTitleVariants,
  }) &&
  (artistName === undefined ||
    getIsAnyVariantEqual({
      expected: artistName,
      variants: albumPage.artistNameVariants,
    }))

const fetchAlbumPage = ({
  albumId,
  cachedFetch,
}: {
  albumId: string
  cachedFetch: CachedFetch
}) =>
  cachedFetch(buildVgmdbAlbumPageUrl(albumId))
    .then(({ body }) => parseVgmdbAlbumPage(body))
    // One unreadable album page drops that album, not the whole search.
    .catch(() => null)

// One page at a time. The rate limiter would space them anyway, but read in
// order a match can stop the walk before the remaining pages are asked for.
const findAlbumPages = ({
  cachedFetch,
  getIsFinished,
  searchResults,
}: {
  cachedFetch: CachedFetch
  getIsFinished: (albumPages: VgmdbAlbumPage[]) => boolean
  searchResults: VgmdbSearchResult[]
}) =>
  searchResults.slice(0, VGMDB_MAXIMUM_ALBUM_PAGES).reduce(
    (pagesSoFar: Promise<VgmdbAlbumPage[]>, searchResult) =>
      pagesSoFar.then((albumPages) =>
        getIsFinished(albumPages)
          ? albumPages
          : fetchAlbumPage({
              albumId: searchResult.albumId,
              cachedFetch,
            }).then((albumPage) =>
              albumPage === null
                ? albumPages
                : albumPages.concat(albumPage),
            ),
      ),
    Promise.resolve<VgmdbAlbumPage[]>([]),
  )

// The search is on the album title alone. VGMdb's album search compares
// words against album titles and catalog numbers, so an artist's name in
// the query would only remove the album being looked for; the artist is
// checked against the album page's credits instead.
//
// A search with exactly one result redirects straight to that album's
// page, so a search body can itself be an album page.
const searchAlbumPages = ({
  albumTitle,
  cachedFetch,
  getIsFinished,
  getIsSearchResultWanted,
}: {
  albumTitle: string
  cachedFetch: CachedFetch
  getIsFinished: (albumPages: VgmdbAlbumPage[]) => boolean
  getIsSearchResultWanted: (
    searchResult: VgmdbSearchResult,
  ) => boolean
}) =>
  albumTitle.trim().length === 0
    ? Promise.resolve<VgmdbAlbumPage[]>([])
    : cachedFetch(buildVgmdbSearchUrl(albumTitle))
        .then(({ body }) =>
          getIsVgmdbChallengePage(body)
            ? []
            : ((redirectedAlbumPage) =>
                redirectedAlbumPage === null
                  ? findAlbumPages({
                      cachedFetch,
                      getIsFinished,
                      searchResults:
                        parseVgmdbSearchResults(
                          body,
                        ).filter(getIsSearchResultWanted),
                    })
                  : [redirectedAlbumPage])(
                parseVgmdbAlbumPage(body),
              ),
        )
        // A 403 challenge, a 404, a timeout: VGMdb is unavailable, and an
        // unavailable search provider reports nothing rather than failing
        // the caller.
        .catch(() => [])

export const searchVgmdbArtworkCandidates = ({
  albumTitle,
  artistName,
  cachedFetch,
}: {
  albumTitle: string
  artistName?: string
  cachedFetch: CachedFetch
}): Observable<VgmdbArtworkCandidate[]> =>
  from(
    searchAlbumPages({
      albumTitle,
      cachedFetch,
      getIsFinished: () => false,
      getIsSearchResultWanted: () => true,
    }).then((albumPages) =>
      // The candidates that match the artist come first, but a search
      // keeps every album it read so a person can still pick one.
      albumPages
        .filter(
          (albumPage) =>
            artistName !== undefined &&
            getIsVgmdbAlbumMatch({
              albumPage,
              albumTitle,
              artistName,
            }),
        )
        .concat(
          albumPages.filter(
            (albumPage) =>
              artistName === undefined ||
              !getIsVgmdbAlbumMatch({
                albumPage,
                albumTitle,
                artistName,
              }),
          ),
        )
        .map((albumPage) => albumPage.candidate),
    ),
  ).pipe(
    logAndRethrowPipelineError(
      searchVgmdbArtworkCandidates,
    ),
  )

const findMatchedAlbumWithCover = ({
  albumPages,
  albumTitle,
  artistName,
}: {
  albumPages: VgmdbAlbumPage[]
  albumTitle: string
  artistName?: string
}) =>
  albumPages.find(
    (albumPage) =>
      albumPage.candidate.imageUrl !== null &&
      getIsVgmdbAlbumMatch({
        albumPage,
        albumTitle,
        artistName,
      }),
  ) ?? null

// The first album whose title — and artist, when one is given — is equal to
// the one asked for AND has a cover. Search results whose titles do not
// match are never opened, so the album pages read are only the plausible
// ones.
export const getVgmdbArtwork = ({
  albumTitle,
  artistName,
  cachedFetch,
}: {
  albumTitle: string
  artistName?: string
  cachedFetch: CachedFetch
}): Observable<VgmdbArtworkCandidate | null> =>
  from(
    searchAlbumPages({
      albumTitle,
      cachedFetch,
      getIsFinished: (albumPages) =>
        findMatchedAlbumWithCover({
          albumPages,
          albumTitle,
          artistName,
        }) !== null,
      getIsSearchResultWanted: (searchResult) =>
        getIsAnyVariantEqual({
          expected: albumTitle,
          variants: searchResult.albumTitleVariants,
        }),
    }).then(
      (albumPages) =>
        findMatchedAlbumWithCover({
          albumPages,
          albumTitle,
          artistName,
        })?.candidate ?? null,
    ),
  ).pipe(logAndRethrowPipelineError(getVgmdbArtwork))
