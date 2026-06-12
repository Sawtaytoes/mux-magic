// Canonical rename-regex shape consumed by `copyFiles`, `moveFiles`,
// and `renameFiles`. Worker 65 added optional `flags` (passed to the
// `RegExp` ctor as the second arg) and `sample` (UI-only documentation
// the runtime ignores). Worker 6e broadened the type to accept an ordered
// chain of rules applied left-to-right. Pre-flags / pre-chain templates
// still satisfy this type because all new fields are optional and the
// single-object form is still accepted.
export type RenameRegexRule = {
  pattern: string
  replacement: string
  flags?: string
  sample?: string
}

export type RenameRegex =
  | RenameRegexRule
  | RenameRegexRule[]

export const applyRenameRegex = (
  name: string,
  renameRegex: RenameRegex | undefined,
): string => {
  if (!renameRegex) return name
  const rules = Array.isArray(renameRegex)
    ? renameRegex
    : [renameRegex]
  return rules.reduce(
    (current, rule) =>
      current.replace(
        new RegExp(rule.pattern, rule.flags),
        rule.replacement,
      ),
    name,
  )
}
