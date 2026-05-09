import { JSDOM } from "jsdom"

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
  element: HTMLElement,
) => (
  Array
  .from(
    element
    .childNodes
  )
  .filter(({
    nodeType,
  }) => (
    nodeType
    === (
      new JSDOM()
      .window
      .Node
      .TEXT_NODE
    )
  ))
  .map((
    textNode
  ) => (
    textNode
    ?.textContent
    ?.trim()
  ))
  .join("")
)

export const getReasonFromMovieTextDomSnippet = (
  jsdomSnippet: JSDOM,
) => {
  const textContentWithoutChildren = (
    getTextContentWithoutChildren(
      jsdomSnippet
      .window
      .document
      .body
    )
  )

  const reason = (
    textContentWithoutChildren
    .replace(
      /^(?!.*Collection).*?\(.+?\) \((.+?)\).*$/,
      "$1",
    )
  )

  return (
    textContentWithoutChildren
    === reason
    ? ""
    : reason
  )
}

export const getReasonsFromDomSnippet = (
  jsdomSnippet: JSDOM,
) => (
  Array
  .from(
    (
      jsdomSnippet
      .window
      .document
      .querySelectorAll<
        HTMLSpanElement
      >(
        "span"
      )
    )
    || []
  )
  .map((
    element
  ) => (
    getTextContentWithoutChildren(
      element
    )
  ))
  .filter((
    textContent,
  ): textContent is string => (
    Boolean(
      textContent
    )
    && (
      // Ensure it's not a section title. Those end with `:`.
      !(
        /:$/
        .test(
          textContent
        )
      )
    )
  ))
  .map((
    textContent,
  ) => (
    textContent
    .replace(
      /^.*\((.+?)\)$/,
      "$1",
    )
  ))
  .filter((
    reason
  ): reason is string => (
    Boolean(
      reason
    )
  ))
  .map((
    reason
  ) => (
    reason
    .trim()
  ))
  .filter(
    Boolean
  )
  .concat(
    getReasonFromMovieTextDomSnippet(
      jsdomSnippet
    )
  )
  .filter(
    Boolean
  )
  .concat(
    Array
    .from(
      (
        jsdomSnippet
        .window
        .document
        .querySelectorAll<
          HTMLAnchorElement
        >(
          "[href]"
        )
      )
      || []
    )
    .filter((
      element
    ) => (
      element
      && (
        (
          element
          .textContent
        )
        ?.match(
          /(review$)|(screenshots)/
        )
      )
    ))
    .map((
      element
    ) => (
      element
      .href
    ))
  )
)

export const getSectionTitleFromDomSnippet = (
  jsdomSnippet: JSDOM,
) => (
  (
    (
      jsdomSnippet
      .window
      .document
      .querySelector(
        `[style="font-size:150%;line-height:116%"]`
      )
      ?.textContent
    )
    || ""
  )
  .trim()
  .replace(
    /:$/,
    "",
  )
)

export const getMovieDataFromDomSnippet = (
  jsdomSnippet: JSDOM,
) => {
  const fakeElement = (
    jsdomSnippet
    .window
    .document
    .createElement(
      "div"
    )
  )

  const textContent = (
    (
      (
        (
          // This function seems unnecessary, but it helps the regex be a lot simpler because some items have no publisher and only a reason, but if you matched with text from children, it would match the reason.
          getTextContentWithoutChildren(
            jsdomSnippet
            .window
            .document
            .body
          )
        )
        || (
          getTextContentWithoutChildren(
            (
              jsdomSnippet
              .window
              .document
              .querySelector(
                "span"
              )
            )
            || fakeElement
          )
        )
      )
    )
    .trim()
  )

  const matches = (
    textContent
    .match(
      /^(?<movieName>(.+ Collection)?.+?) \((?<publisher>.+?)( > (.+?))?\).*$/
    )
  )

  return (
    matches
    ? (
      matches
      .groups
    )
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
  jsdomSnippet: JSDOM,
) => ({
  ...(
    getMovieDataFromDomSnippet(
      jsdomSnippet
    )
  ),
  reasons: (
    getReasonsFromDomSnippet(
      jsdomSnippet
    )
  ),
  sectionTitle: (
    getSectionTitleFromDomSnippet(
      jsdomSnippet
    )
  ),
})

export const processUhdDiscForumPost = (
  /** HTML string of the content from the forum post. */
  formPostContent: string
) => (
  formPostContent
  .split(
    "<br>"
  )
  .filter(
    Boolean
  )
  .map((
    htmlSection,
  ) => (
    new JSDOM(
      htmlSection
    )
  ))
  .map((
    jsdomSnippet,
  ) => (
    parseDomSnippetTextContent(
      jsdomSnippet
    )
  ))
  .filter(({
    sectionTitle,
    movieName,
  }) => (
    sectionTitle
    || movieName
  ))
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
          groups
          .concat({
            items: [],
            title: sectionTitle,
          })
        )
      }

      const lastItem = (
        (
          groups
          .at(-1)
        )
        || (
          {} as (
            UhdDiscForumPostGroup
          )
        )
      )

      return (
        groups
        .slice(0, -1)
        .concat({
          ...lastItem,
          items: (
            lastItem
            .items
            .concat(
              uhdDiscForumPostItem
            )
          ),
        })
      )
    },
    [] satisfies (
      UhdDiscForumPostGroup[]
    ) as (
      UhdDiscForumPostGroup[]
    ),
  )
)
