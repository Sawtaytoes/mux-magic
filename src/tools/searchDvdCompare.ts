import {
  from,
  type Observable,
} from "rxjs"

import { gotoPage, launchBrowser, performAndWaitForNavigation } from "./launchBrowser.js"
import { logAndSwallow } from "./logAndSwallow.js"

export type DvdCompareVariant = "DVD" | "Blu-ray" | "Blu-ray 4K"

// User-facing label. The internal value stays "Blu-ray 4K" because that's
// the literal token DVDCompare.net uses in its HTML; we only relabel it
// for display.
export const displayDvdCompareVariant = (
  variant: DvdCompareVariant,
): string => (
  variant === "Blu-ray 4K" ? "UHD Blu-ray" : variant
)

export type DvdCompareResult = {
  baseTitle: string
  id: number
  variant: DvdCompareVariant
  year: string
}

export type DvdCompareRelease = {
  hash: string
  label: string
}

const DVDCOMPARE_BASE = "https://www.dvdcompare.net"

const decodeHtmlEntities = (text: string): string => (
  text
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, "\"")
  .replace(/&#0?39;/g, "'")
  .replace(/&#0?34;/g, "\"")
)

export const parseDvdCompareTitleText = (
  text: string,
  id: number,
): DvdCompareResult => {
  const fullMatch = text.match(/^(.+?)(?:\s*\((Blu-ray 4K|Blu-ray)\))?\s*\((\d{4})\)\s*$/)

  if (!fullMatch) {
    return { id, baseTitle: text, variant: "DVD", year: "" }
  }

  const [, base, variantToken, year] = fullMatch
  const variant: DvdCompareVariant = (
    variantToken === "Blu-ray 4K"
    ? "Blu-ray 4K"
    : variantToken === "Blu-ray"
    ? "Blu-ray"
    : "DVD"
  )

  return { id, baseTitle: base.trim(), variant, year }
}

export const parseDvdCompareSearchHtml = (
  html: string,
): DvdCompareResult[] => {
  const linkPattern = /<a[^>]+href=["'][^"']*film\.php\?fid=(\d+)[^"']*["'][^>]*>([^<]+)<\/a>/g
  const results: DvdCompareResult[] = []
  let match: RegExpExecArray | null

  while ((match = linkPattern.exec(html)) !== null) {
    const id = Number(match[1])
    if (id <= 0) continue
    const text = decodeHtmlEntities(match[2]).trim()
    results.push(parseDvdCompareTitleText(text, id))
  }

  return results
}

export const findDvdCompareResults = (
  searchTerm: string,
): Observable<DvdCompareResult[]> => (
  from((async () => {
    const formData = new URLSearchParams({
      param: searchTerm,
      searchtype: "text",
    })
    const response = await fetch(
      `${DVDCOMPARE_BASE}/comparisons/search.php`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      },
    )
    const html = await response.text()

    // DVDCompare redirects search.php to a specific film.php page when
    // there's only one match. fetch follows the redirect by default, so
    // the final response.url points at the film. Treat that as a single
    // search result so the builder UI can fast-path through the variant
    // step into the release picker.
    const redirectMatch = response.url.match(/film\.php\?fid=(\d+)/)
    if (redirectMatch) {
      const fid = Number(redirectMatch[1])
      const filmInfo = parseDvdCompareFilmTitle(html, fid)
      if (filmInfo) return [filmInfo]
      return [{ baseTitle: "", id: fid, variant: "DVD" as const, year: "" }]
    }

    return parseDvdCompareSearchHtml(html)
  })())
)

const stripTagsAndCollapse = (html: string): string => (
  decodeHtmlEntities(html.replace(/<[^>]+>/g, " "))
  .replace(/\s+/g, " ")
  .trim()
)

export const parseDvdCompareReleasesHtml = (
  html: string,
): DvdCompareRelease[] => {
  // DVDCompare renders releases as a flat sequence:
  //   <input type=checkbox name=N> Label text <span class="disc-release-year">[YYYY]</span></a><br>
  // Notes captured here:
  //   - Attribute values may be quoted OR unquoted ("\\?" makes the quote optional).
  //   - The wrapping <a> may be missing on the unselected page (only the stray
  //     closing </a> from a sibling element remains); stripTagsAndCollapse
  //     cleans that up.
  //   - Attribute order is irrelevant (we use lookaheads).
  //   - We capture from the input's > up to the next <br> OR <input> OR end of
  //     string, and only accept digit-only names so the hidden "sel" input and
  //     the submit button get filtered out.
  const pattern = /<input\b(?=[^>]*\btype\s*=\s*["']?checkbox\b)(?=[^>]*\bname\s*=\s*["']?(\d+)\b)[^>]*>([\s\S]*?)(?=<br\b|<input\b|$)/gi
  const releases: DvdCompareRelease[] = []
  let match: RegExpExecArray | null

  while ((match = pattern.exec(html)) !== null) {
    const hash = match[1]
    const label = stripTagsAndCollapse(match[2])
    if (label) releases.push({ hash, label })
  }

  return releases
}

export type DvdCompareReleasesDebug = {
  checkboxCount: number
  htmlLength: number
  httpStatus: number
  pageTitle: string
  snippet: string
  url: string
}

export type DvdCompareReleasesResult = {
  debug: DvdCompareReleasesDebug
  releases: DvdCompareRelease[]
}

const buildReleasesDebug = (
  url: string,
  httpStatus: number,
  html: string,
): DvdCompareReleasesDebug => {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const pageTitle = (
    titleMatch
    ? decodeHtmlEntities(titleMatch[1]).replace(/\s+/g, " ").trim()
    : ""
  )
  const checkboxCount = (
    html.match(/<input[^>]*\btype=["']checkbox["']/gi)
    ?? []
  ).length

  // Snippet around the form (or first 600 chars if no form is found)
  const formIndex = html.indexOf("film.php")
  const start = formIndex >= 0 ? Math.max(0, formIndex - 100) : 0
  const snippet = html.slice(start, start + 800)

  return {
    checkboxCount,
    htmlLength: html.length,
    httpStatus,
    pageTitle,
    snippet,
    url,
  }
}

export const listDvdCompareReleases = (
  dvdCompareId: number,
): Observable<DvdCompareReleasesResult> => (
  from((async () => {
    const url = `${DVDCOMPARE_BASE}/comparisons/film.php?fid=${dvdCompareId}&sel=on`
    const response = await fetch(url)
    const html = await response.text()
    const releases = parseDvdCompareReleasesHtml(html)
    const debug = buildReleasesDebug(url, response.status, html)

    if (releases.length === 0) {
      console.info(
        "[listDvdCompareReleases] no releases parsed",
        JSON.stringify({
          url,
          httpStatus: debug.httpStatus,
          htmlLength: debug.htmlLength,
          pageTitle: debug.pageTitle,
          checkboxCount: debug.checkboxCount,
        }),
      )
    }

    return { debug, releases }
  })())
)

// DVDCompare's <title> element historically used "DVD Compare: <Title>"
// but newer pages use "Rewind @ www.dvdcompare.net - <Title>". Both
// prefixes are stripped here so the parsed result is just the film
// portion regardless of which template the page was rendered with.
const stripDvdCompareTitlePrefix = (text: string): string => (
  text
  .replace(/^Rewind\s*@\s*www\.dvdcompare\.net\s*[-:]\s*/i, "")
  .replace(/^DVD\s*Compare\s*[-:]\s*/i, "")
)

export const parseDvdCompareFilmTitle = (
  html: string,
  fid: number,
): DvdCompareResult | null => {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (!titleMatch) return null
  const titleText = (
    stripDvdCompareTitlePrefix(decodeHtmlEntities(titleMatch[1]))
    .replace(/\s+/g, " ")
    .trim()
  )
  if (!titleText) return null
  const parsed = parseDvdCompareTitleText(titleText, fid)
  // If no year was extracted, treat the title as unparseable.
  return parsed.year ? parsed : null
}

export const lookupDvdCompareFilm = (
  dvdCompareId: number,
): Observable<{ name: string } | null> => (
  from((async () => {
    const response = await fetch(
      `${DVDCOMPARE_BASE}/comparisons/film.php?fid=${dvdCompareId}`
    )
    const html = await response.text()
    const result = parseDvdCompareFilmTitle(html, dvdCompareId)
    if (!result) return null
    const variantSuffix = (
      result.variant !== "DVD"
      ? ` (${displayDvdCompareVariant(result.variant)})`
      : ""
    )
    const yearSuffix = result.year ? ` (${result.year})` : ""
    return { name: `${result.baseTitle}${variantSuffix}${yearSuffix}` }
  })())
  .pipe(
    logAndSwallow(lookupDvdCompareFilm),
  )
)

export const lookupDvdCompareRelease = (
  dvdCompareId: number,
  hash: string,
): Observable<{ label: string } | null> => (
  from((async () => {
    const response = await fetch(
      `${DVDCOMPARE_BASE}/comparisons/film.php?fid=${dvdCompareId}&sel=on`
    )
    const html = await response.text()
    const releases = parseDvdCompareReleasesHtml(html)
    const matched = releases.find((r) => r.hash === String(hash))
    return matched ? { label: matched.label } : null
  })())
  .pipe(
    logAndSwallow(lookupDvdCompareRelease),
  )
)

export type DvdCompareReleaseScrape = {
  // Raw text of the chosen release's "Extras" section. Lines are
  // separated by `\n` (the scraper rewrites `<br>` to newlines so the
  // downstream parser's `.split("\n")` actually sees per-item lines).
  extras: string
  // The film's display name + year, parsed from the page <title>. Null
  // when the title can't be parsed (no year present, etc.). When set,
  // the caller can use baseTitle + year directly without a follow-up
  // network round-trip.
  filmTitle: DvdCompareResult | null
}

export const searchDvdCompare = ({
  url,
}: {
  url: string,
}): Observable<DvdCompareReleaseScrape> => (
  from((async () => {
    const browser = await launchBrowser()
    try {
      const page = await browser.newPage()
      // Append &sel=on before the hash so DVDCompare lands on the
      // unchecked-by-default release-picker form regardless of the user's
      // saved cookie state.
      const fullUrl = url.replace(/(.+)(#.+)/, "$1&sel=on$2")
      await gotoPage(page, fullUrl)

      // Capture the page <title> before the form submission triggers a
      // navigation — title content survives the round-trip but reading
      // it now keeps the eval simple.
      const filmIdMatch = url.match(/fid=(\d+)/)
      const filmId = filmIdMatch ? Number(filmIdMatch[1]) : 0
      const rawTitleHtml = `<title>${await page.title()}</title>`
      const filmTitle = parseDvdCompareFilmTitle(rawTitleHtml, filmId)

      const releasePackagesForm = page.locator('form[action^="film.php"]')
      if ((await releasePackagesForm.count()) === 0) {
        throw new Error("No release packages to choose from.")
      }

      // The hash on the inbound URL (e.g. "#3") names the checkbox to tick.
      // Default to "1" when the URL has no hash.
      const urlHash = new URL(url).hash.replace(/#(.+)/, "$1") || "1"
      const releasePackageCheckbox = (
        releasePackagesForm
        .locator(`input[type="checkbox"][name="${urlHash}"]`)
      )
      if ((await releasePackageCheckbox.count()) === 0) {
        throw new Error("Incorrect or no release package selected.")
      }

      await releasePackageCheckbox.check()

      await performAndWaitForNavigation(page, () => (
        releasePackagesForm.locator('[type="submit"]').click()
      ))

      // Multi-disc releases (UHD + BD combos like the Arrow Limited
      // Edition) render one "Extras" label per disc with its own sibling
      // `.description`. Locator.all() collects every one so we don't
      // silently drop disc-2's extras — which on these releases is often
      // where the bulk of the bonus content lives.
      const extrasLabels = await (
        page
        .locator('xpath=.//div[contains(@class, "label") and contains(text(), "Extras")]')
        .all()
      )
      if (extrasLabels.length === 0) {
        throw new Error("No extras for this release.")
      }

      // textContent collapses <br> tags, which DVDCompare uses to
      // separate per-item lines inside .description. Inject a newline
      // for every <br> on a clone of the node so the parser's
      // `.split("\n")` actually sees per-item rows.
      const extrasPerDisc = await Promise.all(
        extrasLabels.map((label) => label.evaluate((element) => {
          const description = (
            element?.parentElement?.querySelector(".description")
            ?? element?.parentElement?.parentElement?.querySelector(".description")
          )
          if (!description) return ""
          const cloned = description.cloneNode(true) as HTMLElement
          cloned.querySelectorAll("br").forEach((br) => {
            br.replaceWith("\n")
          })
          return cloned.textContent ?? ""
        }))
      )
      // Join with double-newline so the downstream parser sees a clean
      // line break between disc-1 and disc-2 entries, and any "DISC TWO"
      // header inside the second block stays at column 0.
      const extras = extrasPerDisc.filter(Boolean).join("\n\n")

      return { extras, filmTitle }
    }
    finally {
      await browser.close()
    }
  })())
  .pipe(
    logAndSwallow(searchDvdCompare),
  )
)
