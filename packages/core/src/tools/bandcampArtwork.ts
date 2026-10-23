import { logAndRethrowPipelineError } from "@mux-magic/tools"
import { JSDOM } from "jsdom"
import { from, type Observable } from "rxjs"

import { normaliseTitleForIdentifierMatch } from "./discogsArtwork.js"
import type { CachedFetch } from "./musicBrainzApi.js"
import {
  getIsPathAllowedByRobots,
  parseRobotsTxtForAnyAgent,
  type RobotsRule,
} from "./robotsTxt.js"

// The politeness interval (3000 ms; Bandcamp publishes no API and no rate
// limit) lives on `bandcampCachedFetch` in musicProviderFetchers.ts.

// Bandcamp serves every size of a cover from one id, chosen by the suffix:
// `a<art id>_<size>.jpg` on f4.bcbits.com. `_2` is the 350 x 350 grid
// thumbnail and `_5` / `_16` are 700 x 700. `_10` is capped at 1200 x 1200
// and re-encoded. `_0` is the ORIGINAL upload — measured 2026-10-23: a
// 1500 x 1500 cover came back 1500 x 1500 at `_0` and 1200 x 1200 at `_10`,
// and a 640 x 640 cover came back at twice the bytes of `_10` at the same
// size. The same "original, not a thumbnail" rule `ITUNES_ARTWORK_SIZE` and
// the Cover Art Archive follow. Because it is the upload, `_0` can be a PNG
// behind a `.jpg` name; read the response's Content-Type, not the extension.
export const BANDCAMP_ARTWORK_SIZE_SUFFIX = "_0"

export const BANDCAMP_IMAGE_BASE_URL =
  "https://f4.bcbits.com/img"

// A track title that no single matches is looked for inside the artist's
// albums, one page per album. The cap keeps a large discography to at most
// 20 page reads (about a minute at the politeness interval) per lookup.
export const BANDCAMP_MAXIMUM_ALBUM_PAGES_PER_LOOKUP = 20

// Disallowed by Bandcamp's robots.txt today. Refused here as well, so a
// change to that file can never turn this provider into a search client.
const REFUSED_PATH_PREFIXES = ["/api/", "/search"]

// A listing page is the discography grid; when an artist has one release,
// Bandcamp redirects both of these to that release's own page instead.
const LISTING_PATHS = ["/music", "/"]

export type BandcampArtworkCandidate = {
  artistName: string
  imageUrl: string
  itemKind: "album" | "track"
  pageUrl: string
  title: string
}

// `trackTitles` is known only when the release was read from its own page,
// which is what lets a one-release artist answer a track lookup with no
// second request.
type BandcampRelease = BandcampArtworkCandidate & {
  trackTitles: string[] | null
}

type BandcampSite = {
  cachedFetch: CachedFetch
  origin: string
  robotsRules: RobotsRule[]
}

type BandcampClientItem = {
  art_id?: number | null
  artist?: string | null
  page_url?: string
  title?: string
  type?: string
}

type BandcampTralbum = {
  art_id?: number | null
  artist?: string | null
  current?: { title?: string | null }
  item_type?: string
  trackinfo?: { title?: string | null }[]
  url?: string
}

export const upgradeBandcampImageUrl = (imageUrl: string) =>
  imageUrl.replace(
    /(\/img\/a?\d+)_\d+\.(jpg|png)$/u,
    `$1${BANDCAMP_ARTWORK_SIZE_SUFFIX}.$2`,
  )

// The grid's own JSON carries the art id rather than a URL. The file name
// is the id padded to ten digits, as the grid's rendered thumbnails show.
export const buildBandcampImageUrlFromArtId = (
  artId: number | null | undefined,
) =>
  artId === null || artId === undefined || artId === 0
    ? ""
    : `${BANDCAMP_IMAGE_BASE_URL}/a${String(artId).padStart(10, "0")}${BANDCAMP_ARTWORK_SIZE_SUFFIX}.jpg`

const collapseWhitespace = (text: string) =>
  text.replace(/\s+/gu, " ").trim()

const getMetaContent = ({
  pageDocument,
  property,
}: {
  pageDocument: Document
  property: string
}) =>
  collapseWhitespace(
    pageDocument
      .querySelector(`meta[property="${property}"]`)
      ?.getAttribute("content") ?? "",
  )

const getSiteArtistName = (pageDocument: Document) =>
  getMetaContent({
    pageDocument,
    property: "og:site_name",
  }) ||
  getMetaContent({ pageDocument, property: "og:title" })

const getItemKind = (itemType: string) =>
  itemType === "track" || itemType === "album"
    ? itemType
    : null

const resolvePageUrl = ({
  origin,
  path,
}: {
  origin: string
  path: string
}) => new URL(path, origin).href

// The title is the text directly inside `p.title`. A release credited to
// someone other than the page's artist adds a `<br>` and an
// `.artist-override` span, which is the artist, not the title.
const getGridItemTitle = (item: Element) =>
  collapseWhitespace(
    Array.from(
      item.querySelector("p.title")?.childNodes ?? [],
    )
      .filter((node) => node.nodeName === "#text")
      .map((node) => node.textContent ?? "")
      .join(""),
  )

// Thumbnails past the first rows load lazily: `src` is a placeholder gif
// and the real image is in `data-original`.
const getGridItemImageUrl = (item: Element) =>
  ((image: Element | null) =>
    upgradeBandcampImageUrl(
      image?.getAttribute("data-original") ??
        image?.getAttribute("src") ??
        "",
    ))(item.querySelector(".art img"))

const buildGridItemRelease = ({
  artistName,
  item,
  origin,
}: {
  artistName: string
  item: Element
  origin: string
}): BandcampRelease | null =>
  ((itemKind: "album" | "track" | null) =>
    itemKind === null
      ? null
      : {
          artistName:
            collapseWhitespace(
              item.querySelector(".artist-override")
                ?.textContent ?? "",
            ) || artistName,
          imageUrl: getGridItemImageUrl(item),
          itemKind,
          pageUrl: resolvePageUrl({
            origin,
            path:
              item
                .querySelector("a")
                ?.getAttribute("href") ?? "",
          }),
          title: getGridItemTitle(item),
          trackTitles: null,
        })(
    getItemKind(
      (item.getAttribute("data-item-id") ?? "").replace(
        /-\d+$/u,
        "",
      ),
    ),
  )

const buildClientItemRelease = ({
  artistName,
  clientItem,
  origin,
}: {
  artistName: string
  clientItem: BandcampClientItem
  origin: string
}): BandcampRelease | null =>
  ((itemKind: "album" | "track" | null) =>
    itemKind === null
      ? null
      : {
          artistName: clientItem.artist || artistName,
          imageUrl: buildBandcampImageUrlFromArtId(
            clientItem.art_id,
          ),
          itemKind,
          pageUrl: resolvePageUrl({
            origin,
            path: clientItem.page_url ?? "",
          }),
          title: collapseWhitespace(clientItem.title ?? ""),
          trackTitles: null,
        })(getItemKind(clientItem.type ?? ""))

const parseJsonLater = <Parsed>(text: string) =>
  Promise.resolve(text)
    .then((jsonText) => JSON.parse(jsonText) as Parsed)
    .catch(() => null)

const getIsUsableRelease = (
  release: BandcampRelease | null,
): release is BandcampRelease =>
  release !== null &&
  release.imageUrl.length > 0 &&
  release.title.length > 0

const removeDuplicatePages = (
  releases: BandcampRelease[],
) =>
  releases.filter(
    (release, index) =>
      releases.findIndex(
        (other) => other.pageUrl === release.pageUrl,
      ) === index,
  )

// The grid renders its first items as `<li>` elements and carries the rest
// as JSON in `data-client-items`, which the page's script renders on scroll.
// Both are read, so a long discography is listed whole.
const parseDiscographyGrid = ({
  origin,
  pageDocument,
}: {
  origin: string
  pageDocument: Document
}) =>
  ((artistName: string) =>
    parseJsonLater<BandcampClientItem[]>(
      pageDocument
        .querySelector("#music-grid")
        ?.getAttribute("data-client-items") ?? "[]",
    ).then((clientItems) =>
      removeDuplicatePages(
        Array.from(
          pageDocument.querySelectorAll(
            "#music-grid li.music-grid-item",
          ),
        )
          .map((element) =>
            buildGridItemRelease({
              artistName,
              item: element,
              origin,
            }),
          )
          .concat(
            (Array.isArray(clientItems)
              ? clientItems
              : []
            ).map((clientItem) =>
              buildClientItemRelease({
                artistName,
                clientItem,
                origin,
              }),
            ),
          )
          .filter(getIsUsableRelease),
      ),
    ))(getSiteArtistName(pageDocument))

const buildTralbumRelease = ({
  origin,
  pageDocument,
  tralbum,
}: {
  origin: string
  pageDocument: Document
  tralbum: BandcampTralbum
}): BandcampRelease => ({
  artistName:
    collapseWhitespace(tralbum.artist ?? "") ||
    getSiteArtistName(pageDocument),
  imageUrl:
    upgradeBandcampImageUrl(
      getMetaContent({
        pageDocument,
        property: "og:image",
      }),
    ) || buildBandcampImageUrlFromArtId(tralbum.art_id),
  itemKind:
    tralbum.item_type === "track" ? "track" : "album",
  pageUrl: resolvePageUrl({
    origin,
    path: tralbum.url ?? "",
  }),
  title: collapseWhitespace(tralbum.current?.title ?? ""),
  trackTitles: (tralbum.trackinfo ?? [])
    .map((track) => collapseWhitespace(track.title ?? ""))
    .filter((title) => title.length > 0),
})

// One album or track page. The page's `data-tralbum` JSON is the same data
// its player runs on, and it is where the track list lives.
const parseReleasePage = ({
  origin,
  pageDocument,
}: {
  origin: string
  pageDocument: Document
}) =>
  parseJsonLater<BandcampTralbum>(
    pageDocument
      .querySelector("[data-tralbum]")
      ?.getAttribute("data-tralbum") ?? "",
  ).then((tralbum) =>
    tralbum === null
      ? []
      : [
          buildTralbumRelease({
            origin,
            pageDocument,
            tralbum,
          }),
        ].filter(getIsUsableRelease),
  )

// `null` means the page is neither a discography nor a release, so the
// next listing path is tried.
export const parseBandcampPage = ({
  body,
  origin,
}: {
  body: string
  origin: string
}): Promise<BandcampRelease[] | null> =>
  ((pageDocument: Document) =>
    pageDocument.querySelector("#music-grid") !== null
      ? parseDiscographyGrid({ origin, pageDocument })
      : pageDocument.querySelector("[data-tralbum]") !==
          null
        ? parseReleasePage({ origin, pageDocument })
        : Promise.resolve(null))(
    // Static HTML only: JSDOM runs no page scripts by default, and every
    // field read here is in the server-rendered markup and attributes.
    new JSDOM(body).window.document,
  )

const getErrorStatus = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "status" in error &&
  typeof error.status === "number"
    ? error.status
    : null

// RFC 9309: a robots.txt that does not exist (a 4xx) restricts nothing,
// and one that cannot be read (a 5xx, a 429, a network error) restricts
// everything. `null` here is "refuse every page on this host".
const readRobotsRules = ({
  cachedFetch,
  origin,
}: {
  cachedFetch: CachedFetch
  origin: string
}) =>
  cachedFetch(`${origin}/robots.txt`)
    .then(({ body }) => parseRobotsTxtForAnyAgent(body))
    .catch((error: unknown) =>
      ((status: number | null) =>
        status !== null &&
        status >= 400 &&
        status < 500 &&
        status !== 429
          ? []
          : null)(getErrorStatus(error)),
    )

// Only the artist's own host is read. A page on any other host would need
// that host's robots.txt, which this lookup never fetched.
export const getIsBandcampUrlFetchable = ({
  origin,
  robotsRules,
  url,
}: {
  origin: string
  robotsRules: RobotsRule[]
  url: string
}) =>
  ((parsedUrl: URL) =>
    parsedUrl.origin === origin &&
    REFUSED_PATH_PREFIXES.every(
      (prefix) => !parsedUrl.pathname.startsWith(prefix),
    ) &&
    getIsPathAllowedByRobots({
      path: `${parsedUrl.pathname}${parsedUrl.search}`,
      rules: robotsRules,
    }))(new URL(url))

const getArtistOrigin = (artistPageUrl: string) =>
  Promise.resolve(artistPageUrl)
    .then((url) => new URL(url))
    .then((parsedUrl) =>
      parsedUrl.protocol === "https:" ||
      parsedUrl.protocol === "http:"
        ? parsedUrl.origin
        : null,
    )
    .catch(() => null)

const openBandcampSite = ({
  artistPageUrl,
  cachedFetch,
}: {
  artistPageUrl: string
  cachedFetch: CachedFetch
}) =>
  getArtistOrigin(artistPageUrl).then((origin) =>
    origin === null
      ? null
      : readRobotsRules({ cachedFetch, origin }).then(
          (robotsRules): BandcampSite | null =>
            robotsRules === null
              ? null
              : { cachedFetch, origin, robotsRules },
        ),
  )

// A refused page and a failed page are the same outcome: nothing to read.
// Bandcamp's own redirect (a one-release artist's `/music` to that release)
// is followed by `fetch`; it stays on the same host.
const readPage = ({
  site,
  url,
}: {
  site: BandcampSite
  url: string
}) =>
  Promise.resolve(url)
    .then((pageUrl) =>
      getIsBandcampUrlFetchable({
        origin: site.origin,
        robotsRules: site.robotsRules,
        url: pageUrl,
      })
        ? site.cachedFetch(pageUrl).then(({ body }) =>
            parseBandcampPage({
              body,
              origin: site.origin,
            }),
          )
        : null,
    )
    .catch(() => null)

const readListedReleases = (site: BandcampSite) =>
  LISTING_PATHS.reduce(
    (
      foundSoFar: Promise<BandcampRelease[] | null>,
      listingPath,
    ) =>
      foundSoFar.then((found) =>
        found === null
          ? readPage({
              site,
              url: `${site.origin}${listingPath}`,
            })
          : found,
      ),
    Promise.resolve(null),
  ).then((releases) => releases ?? [])

const toCandidate = ({
  trackTitles: _trackTitles,
  ...candidate
}: BandcampRelease): BandcampArtworkCandidate => candidate

// A wrong cover is worse than none, so a title must be EQUAL once case,
// punctuation and spacing are gone — never "close". The any-script
// normaliser keeps a Japanese title as its own characters instead of
// collapsing it to "", and an expected title that still normalises to ""
// is a missing check, not a match.
const getIsTitleEqual = ({
  candidate,
  expected,
}: {
  candidate: string
  expected: string
}) =>
  ((normalisedExpected: string) =>
    normalisedExpected.length > 0 &&
    normaliseTitleForIdentifierMatch(candidate) ===
      normalisedExpected)(
    normaliseTitleForIdentifierMatch(expected),
  )

const findListedRelease = ({
  expectedTitle,
  itemKind,
  releases,
}: {
  expectedTitle: string
  itemKind: "album" | "track"
  releases: BandcampRelease[]
}) =>
  releases.find(
    (release) =>
      release.itemKind === itemKind &&
      getIsTitleEqual({
        candidate: release.title,
        expected: expectedTitle,
      }),
  ) ?? null

const getHasTrackTitle = ({
  release,
  trackTitle,
}: {
  release: BandcampRelease
  trackTitle: string
}) =>
  (release.trackTitles ?? []).some((candidate) =>
    getIsTitleEqual({ candidate, expected: trackTitle }),
  )

const readAlbumWithTrack = ({
  release,
  site,
  trackTitle,
}: {
  release: BandcampRelease
  site: BandcampSite
  trackTitle: string
}) =>
  (release.trackTitles === null
    ? readPage({ site, url: release.pageUrl }).then(
        (releases) => releases?.at(0) ?? null,
      )
    : Promise.resolve(release)
  ).then((albumPage) =>
    albumPage !== null &&
    albumPage.itemKind === "album" &&
    getHasTrackTitle({ release: albumPage, trackTitle })
      ? albumPage
      : null,
  )

// A song released only on an album: open the albums one at a time, in the
// grid's order, and stop at the first whose track list has the title.
const findAlbumWithTrack = ({
  releases,
  site,
  trackTitle,
}: {
  releases: BandcampRelease[]
  site: BandcampSite
  trackTitle: string
}) =>
  releases
    .filter((release) => release.itemKind === "album")
    .slice(0, BANDCAMP_MAXIMUM_ALBUM_PAGES_PER_LOOKUP)
    .reduce(
      (
        foundSoFar: Promise<BandcampRelease | null>,
        release,
      ) =>
        foundSoFar.then(
          (found) =>
            found ??
            readAlbumWithTrack({
              release,
              site,
              trackTitle,
            }),
        ),
      Promise.resolve(null),
    )

const findMatchingRelease = ({
  albumTitle,
  releases,
  site,
  trackTitle,
}: {
  albumTitle: string
  releases: BandcampRelease[]
  site: BandcampSite
  trackTitle: string
}) =>
  findListedRelease({
    expectedTitle: albumTitle,
    itemKind: "album",
    releases,
  }) ??
  findListedRelease({
    expectedTitle: trackTitle,
    itemKind: "track",
    releases,
  }) ??
  (normaliseTitleForIdentifierMatch(trackTitle).length > 0
    ? findAlbumWithTrack({ releases, site, trackTitle })
    : null)

// Every release on the artist's own discography, unfiltered, so a caller
// can show near-misses for review. The artist is identified by the page URL
// the caller supplies (MusicBrainz carries it as a "bandcamp" URL relation);
// this never searches.
export const listBandcampArtistReleases = ({
  artistPageUrl,
  cachedFetch,
}: {
  artistPageUrl: string
  cachedFetch: CachedFetch
}): Observable<BandcampArtworkCandidate[]> =>
  from(
    openBandcampSite({ artistPageUrl, cachedFetch })
      .then((site) =>
        site === null ? [] : readListedReleases(site),
      )
      .then((releases) => releases.map(toCandidate))
      // An unreachable artist page is an empty list, not a failed job.
      .catch(() => []),
  ).pipe(
    logAndRethrowPipelineError(listBandcampArtistReleases),
  )

// Strict: the album title must equal an album on the artist's page, or the
// track title must equal a single, or a title on one of the artist's album
// track lists (that album's cover is returned). A failure, a refusal by
// robots.txt, or a 403/404 is `null`, never a throw.
export const getBandcampArtwork = ({
  albumTitle = "",
  artistPageUrl,
  cachedFetch,
  trackTitle = "",
}: {
  albumTitle?: string
  artistPageUrl: string
  cachedFetch: CachedFetch
  trackTitle?: string
}): Observable<BandcampArtworkCandidate | null> =>
  from(
    normaliseTitleForIdentifierMatch(albumTitle).length ===
      0 &&
      normaliseTitleForIdentifierMatch(trackTitle)
        .length === 0
      ? Promise.resolve(null)
      : openBandcampSite({ artistPageUrl, cachedFetch })
          .then((site) =>
            site === null
              ? null
              : readListedReleases(site).then((releases) =>
                  findMatchingRelease({
                    albumTitle,
                    releases,
                    site,
                    trackTitle,
                  }),
                ),
          )
          .then((release) =>
            release === null ? null : toCandidate(release),
          )
          .catch(() => null),
  ).pipe(logAndRethrowPipelineError(getBandcampArtwork))
