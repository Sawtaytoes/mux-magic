/**
 * Field scanner for MakeMKV robot-mode lines.
 *
 * Ported from rip-deck `packages/daemon/src/makemkv/scanFields.ts`
 * (2026-08-12), rewritten from its `while` + `let` scanner into a reduce
 * over characters to satisfy this repo's code rules. Behaviour is pinned
 * by the ported test suite.
 *
 * Hand-rolled on purpose. A CSV library is the obvious reach and it is
 * wrong here, because makemkvcon does not emit CSV:
 *
 *  - Quoted fields escape a literal quote TWO different ways — CSV-style
 *    `""` and C-style `\"`. The backslash form is not hypothetical:
 *    `MSG:5072` ("Backing up disc into folder \"file:///…\"") uses it on
 *    every backup, and it was the one malformed line in a 57,483-line
 *    real capture. Handling only `""` ends the field at the first `\"`,
 *    undercounts the fields, and the whole message is discarded.
 *  - UNQUOTED fields may contain a bare `"` (disc volume labels routinely
 *    do), which makes a strict CSV parser throw or silently swallow the
 *    rest of the line.
 *  - Quoted fields contain commas (`"Alien, Aliens & Alien 3"`), so naive
 *    `.split(",")` is equally wrong.
 *
 * The rule that keeps this simple: quoting is only significant when a
 * field STARTS with `"`. Anywhere else a quote is just a character.
 */

export type ScannedLine = {
  prefix: string
  fields: string[]
}

type ScanState = {
  completedFields: string[]
  currentField: string
  isInsideQuotes: boolean
  isAfterEscape: boolean
  isAfterClosingQuote: boolean
}

const initialScanState: ScanState = {
  completedFields: [],
  currentField: "",
  isInsideQuotes: false,
  isAfterEscape: false,
  isAfterClosingQuote: false,
}

const appendCharacter = ({
  character,
  state,
}: {
  character: string
  state: ScanState
}) => ({
  ...state,
  currentField: state.currentField.concat(character),
})

const completeField = (state: ScanState) => ({
  ...initialScanState,
  completedFields: state.completedFields.concat(
    state.currentField,
  ),
})

/**
 * The character directly after a backslash inside a quoted field.
 *
 * MakeMKV emits `\"` and `\\`; any other `\x` is left alone rather than
 * unescaped, because inventing escape sequences MakeMKV does not emit
 * would corrupt Windows-style paths, which are full of lone backslashes.
 */
const applyEscapedCharacter = ({
  character,
  state,
}: {
  character: string
  state: ScanState
}) => ({
  ...appendCharacter({
    character:
      character === '"' || character === "\\"
        ? character
        : "\\".concat(character),
    state,
  }),
  isAfterEscape: false,
})

const applyQuotedCharacter = ({
  character,
  state,
}: {
  character: string
  state: ScanState
}) =>
  character === "\\"
    ? { ...state, isAfterEscape: true }
    : character === '"'
      ? {
          ...state,
          isAfterClosingQuote: true,
          isInsideQuotes: false,
        }
      : appendCharacter({ character, state })

/**
 * The character directly after a quoted field's closing quote.
 *
 * A second quote here is a doubled-quote escape, so the field resumes.
 * A comma ends the field. Anything else is trailing garbage that is kept
 * rather than dropped — makemkvcon does not emit it, and silently
 * truncating the rest of a line is the worse failure of the two.
 */
const applyAfterClosingQuoteCharacter = ({
  character,
  state,
}: {
  character: string
  state: ScanState
}) =>
  character === '"'
    ? {
        ...appendCharacter({ character: '"', state }),
        isAfterClosingQuote: false,
        isInsideQuotes: true,
      }
    : character === ","
      ? completeField(state)
      : {
          ...appendCharacter({ character, state }),
          isAfterClosingQuote: false,
        }

const applyPlainCharacter = ({
  character,
  state,
}: {
  character: string
  state: ScanState
}) =>
  character === '"' && state.currentField === ""
    ? { ...state, isInsideQuotes: true }
    : character === ","
      ? completeField(state)
      : appendCharacter({ character, state })

/**
 * Split the payload of a robot-mode line into raw fields.
 *
 * Exported separately from `scanLine` so it can be tested against
 * pathological values directly.
 *
 * An unterminated quote is tolerated rather than thrown: a truncated log
 * line (killed mid-write, which happens every time a rip is killed)
 * should degrade to a best-effort value, not take down the parser.
 */
export const scanFields = (payload: string) =>
  ((finalState: ScanState) =>
    finalState.completedFields.concat(
      finalState.isAfterEscape
        ? finalState.currentField.concat("\\")
        : finalState.currentField,
    ))(
    Array.from(payload).reduce(
      (state, character) =>
        state.isAfterEscape
          ? applyEscapedCharacter({ character, state })
          : state.isInsideQuotes
            ? applyQuotedCharacter({ character, state })
            : state.isAfterClosingQuote
              ? applyAfterClosingQuoteCharacter({
                  character,
                  state,
                })
              : applyPlainCharacter({ character, state }),
      initialScanState,
    ),
  )

const robotPrefixPattern = /^[A-Z]{3,6}$/

/**
 * Split a full line into its prefix and fields.
 *
 * Returns null when the line has no `PREFIX:` shape at all, so callers
 * can classify it as UNKNOWN rather than guessing. Only the FIRST colon
 * is a separator — message text is full of them ("Error: ...", timecodes,
 * device paths).
 */
export const scanLine = (
  line: string,
): ScannedLine | null =>
  ((trimmed: string) =>
    ((colonIndex: number) =>
      colonIndex <= 0 ||
      !robotPrefixPattern.test(trimmed.slice(0, colonIndex))
        ? null
        : {
            fields: scanFields(
              trimmed.slice(colonIndex + 1),
            ),
            prefix: trimmed.slice(0, colonIndex),
          })(trimmed.indexOf(":")))(line.replace(/\r$/, ""))
