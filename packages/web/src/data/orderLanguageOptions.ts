import { ISO_639_2_LANGUAGES } from "./iso639-2"

const ENG_PINNED = "eng"
const MAX_DROPDOWN_OPTIONS = 50

type Options = {
  filterText: string
  excluded?: readonly string[]
}

export const buildOrderedLanguageOptions = ({
  filterText,
  excluded = [],
}: Options) => {
  const lower = filterText.toLowerCase()
  const matches = lower
    ? ISO_639_2_LANGUAGES.filter(
        ({ code, name }) =>
          code.includes(lower) ||
          name.toLowerCase().includes(lower),
      )
    : ISO_639_2_LANGUAGES

  const engEntry = matches.find(
    ({ code }) => code === ENG_PINNED,
  )
  const rest = matches.filter(
    ({ code }) => code !== ENG_PINNED,
  )
  const ordered = engEntry ? [engEntry, ...rest] : rest
  return ordered
    .filter(({ code }) => !excluded.includes(code))
    .slice(0, MAX_DROPDOWN_OPTIONS)
}
