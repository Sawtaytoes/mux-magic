const getStyleNameWords = (styleName: string) =>
  ((separatedName: string) =>
    [
      separatedName,
      separatedName.replace(
        /([A-Z]+)([A-Z][a-z])/g,
        "$1 $2",
      ),
    ]
      .flatMap(
        (styleVariant) =>
          styleVariant.match(/[A-Za-z]+/g) ?? [],
      )
      .map((styleWord) => styleWord.toLowerCase()))(
    styleName.replace(/([a-z])([A-Z])/g, "$1 $2"),
  )

const matchIgnoredStyleName =
  ({
    ignoredStyleNamesRegex,
    ignoredStyleNameWords,
  }: {
    ignoredStyleNamesRegex: RegExp | null
    ignoredStyleNameWords: string[]
  }) =>
  (styleName: string) =>
    Boolean(ignoredStyleNamesRegex?.test(styleName)) ||
    getStyleNameWords(styleName).some((styleWord) =>
      ignoredStyleNameWords.includes(styleWord),
    )

export const createIgnoredStyleNameMatcher = ({
  ignoredStyleNamesRegexString,
  ignoredStyleNameWords = [],
}: {
  ignoredStyleNamesRegexString?: string
  ignoredStyleNameWords?: string[]
}) =>
  matchIgnoredStyleName({
    ignoredStyleNamesRegex: ignoredStyleNamesRegexString
      ? new RegExp(ignoredStyleNamesRegexString, "i")
      : null,
    ignoredStyleNameWords: ignoredStyleNameWords.map(
      (styleWord) => styleWord.trim().toLowerCase(),
    ),
  })
