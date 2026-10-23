// A robots.txt reader for the one question a provider here asks: may a
// generic client fetch this path? Only the `User-agent: *` group is read.
// Matching follows RFC 9309: a pattern matches from the start of the path,
// `*` matches any run of characters, a trailing `$` anchors the end, the
// longest matching pattern wins, and an Allow wins a tie.

export type RobotsRule = {
  isAllowed: boolean
  pattern: string
}

type RobotsParseState = {
  isInAnyAgentGroup: boolean
  isPreviousLineUserAgent: boolean
  rules: RobotsRule[]
}

const getDirective = (line: string) =>
  ((withoutComment: string) =>
    ((separatorIndex: number) =>
      separatorIndex === -1
        ? null
        : {
            field: withoutComment
              .slice(0, separatorIndex)
              .trim()
              .toLowerCase(),
            value: withoutComment
              .slice(separatorIndex + 1)
              .trim(),
          })(withoutComment.indexOf(":")))(
    line.replace(/#.*$/u, ""),
  )

const applyDirective = ({
  directive,
  state,
}: {
  directive: { field: string; value: string }
  state: RobotsParseState
}): RobotsParseState =>
  directive.field === "user-agent"
    ? {
        // Consecutive User-agent lines name one group, so a `*` anywhere
        // in the run puts the whole group's rules in scope.
        isInAnyAgentGroup:
          (state.isPreviousLineUserAgent &&
            state.isInAnyAgentGroup) ||
          directive.value === "*",
        isPreviousLineUserAgent: true,
        rules: state.rules,
      }
    : {
        isInAnyAgentGroup: state.isInAnyAgentGroup,
        isPreviousLineUserAgent: false,
        // An empty `Disallow:` allows everything, which is the same as no
        // rule at all.
        rules:
          state.isInAnyAgentGroup &&
          (directive.field === "allow" ||
            directive.field === "disallow") &&
          directive.value.length > 0
            ? state.rules.concat({
                isAllowed: directive.field === "allow",
                pattern: directive.value,
              })
            : state.rules,
      }

export const parseRobotsTxtForAnyAgent = (
  robotsText: string,
) =>
  robotsText
    .split(/\r?\n/u)
    .map(getDirective)
    .reduce(
      (state: RobotsParseState, directive) =>
        directive === null
          ? state
          : applyDirective({ directive, state }),
      {
        isInAnyAgentGroup: false,
        isPreviousLineUserAgent: false,
        rules: [],
      },
    ).rules

const escapeForExpression = (text: string) =>
  text.replace(/[.+?^${}()|[\]\\]/gu, "\\$&")

const buildPatternExpression = (pattern: string) =>
  ((isEndAnchored: boolean) =>
    new RegExp(
      `^${(isEndAnchored ? pattern.slice(0, -1) : pattern)
        .split("*")
        .map(escapeForExpression)
        .join(".*")}${isEndAnchored ? "$" : ""}`,
      "u",
    ))(pattern.endsWith("$"))

// `path` is the path plus any query string, exactly as it would be requested.
export const getIsPathAllowedByRobots = ({
  path,
  rules,
}: {
  path: string
  rules: RobotsRule[]
}) =>
  path === "/robots.txt" ||
  (
    rules
      .filter((rule) =>
        buildPatternExpression(rule.pattern).test(path),
      )
      .reduce(
        (winner: RobotsRule | null, rule) =>
          winner === null ||
          rule.pattern.length > winner.pattern.length ||
          (rule.pattern.length === winner.pattern.length &&
            rule.isAllowed)
            ? rule
            : winner,
        null,
      ) ?? { isAllowed: true }
  ).isAllowed
