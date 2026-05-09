import * as cheerio from "cheerio"

export type UhdDiscForumPostItem = {
  movieName: string
  publisher?: string
  reasons?: string[]
}

export type UhdDiscForumPostSection = {
  sectionTitle: string
}

export type UhdDiscForumPostGroup = {
  items: UhdDiscForumPostItem[]
  title: string
}

/**
 * Ensures we only get the parent element text.
 *
 * Avoids returning strings from children which may also match a regex.
 */
export const getTextContentWithoutChildren = (
  element: cheerio.Cheerio<cheerio.Element>,
) => (
  element
    .contents()
    .filter((_, el) => el.type === "text")
    .map((_, el) => (el.data || "").trim())
    .get()
    .join("")
)

export const getReasonFromMovieTextDomSnippet = (
  $: cheerio.CheerioAPI,
  $body: cheerio.Cheerio<cheerio.Element>,
) => {
  const textContentWithoutChildren = getTextContentWithoutChildren($body)

  const reason = (
    textContentWithoutChildren
      .replace(
        /^(?!.*Collection).*?\(.+?\) \((.+?)\).*$/,
        "$1",
      )
  )

  return (
    textContentWithoutChildren === reason
      ? ""
      : reason
  )
}

export const getReasonsFromDomSnippet = (
  $: cheerio.CheerioAPI,
  $body: cheerio.Cheerio<cheerio.Element>,
) => (
  $("span", $body)
    .map((_, el) => getTextContentWithoutChildren($(el)))
    .get()
    .filter((textContent): textContent is string => (
      Boolean(textContent) && !/:$/.test(textContent)
    ))
    .map(textContent =>
      textContent.replace(/^.*\((.+?)\)$/, "$1")
    )
    .filter(Boolean)
    .map(reason => reason.trim())
    .filter(Boolean)
    .concat(
      getReasonFromMovieTextDomSnippet($, $body)
    )
    .filter(Boolean)
    .concat(
      $("a[href]", $body)
        .filter((_, el) => (
          Boolean($(el).text().match(/(review$)|(screenshots)/))
        ))
        .map((_, el) => $(el).attr("href") || "")
        .get()
    )
)

export const getSectionTitleFromDomSnippet = (
  $: cheerio.CheerioAPI,
  $body: cheerio.Cheerio<cheerio.Element>,
) => (
  (
    $body.find(`[style="font-size:150%;line-height:116%"]`).text() || ""
  )
    .trim()
    .replace(/:$/, "")
)

export const getMovieDataFromDomSnippet = (
  $: cheerio.CheerioAPI,
  $body: cheerio.Cheerio<cheerio.Element>,
) => {
  const fakeElement = $("<div></div>")
  const textContent = (
    getTextContentWithoutChildren($body)
    || getTextContentWithoutChildren($body.find("span").first() || fakeElement)
  ).trim()

  const matches = textContent.match(
    /^(?<movieName>(.+ Collection)?.+?) \((?<publisher>.+?)( > (.+?))?\).*$/
  )

  return (
    matches
      ? matches.groups
      : {
        movieName: "",
        publisher: "",
      }
  ) as (
    Pick<
      UhdDiscForumPostItem,
      (
        | "movieName"
        | "publisher"
      )
    >
  )
}

export const parseDomSnippetTextContent = (
  $: cheerio.CheerioAPI,
  $body: cheerio.Cheerio<cheerio.Element>,
) => ({
  ...getMovieDataFromDomSnippet($, $body),
  reasons: getReasonsFromDomSnippet($, $body),
  sectionTitle: getSectionTitleFromDomSnippet($, $body),
})

export const processUhdDiscForumPost = (
  /** HTML string of the content from the forum post. */
  formPostContent: string
) => (
  formPostContent
    .split("<br>")
    .filter(Boolean)
    .map(htmlSection => {
      const $ = cheerio.load(htmlSection)
      const $body = $("body").length ? $("body") : $.root()
      return parseDomSnippetTextContent($, $body)
    })
    .filter(({ sectionTitle, movieName }) => sectionTitle || movieName)
    .reduce(
      (
        groups,
        {
          sectionTitle,
          ...uhdDiscForumPostItem
        },
      ) => {
        if (sectionTitle) {
          return (
            groups.concat({
              items: [],
              title: sectionTitle,
            })
          )
        }

        const lastItem = (
          groups.at(-1) || ({} as UhdDiscForumPostGroup)
        )

        return (
          groups
            .slice(0, -1)
            .concat({
              ...lastItem,
              items: (
                lastItem.items.concat(
                  uhdDiscForumPostItem
                )
              ),
            })
        )
      },
      [] as UhdDiscForumPostGroup[],
    )
)
