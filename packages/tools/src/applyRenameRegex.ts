// Canonical rename-regex shape consumed by `copyFiles`, `moveFiles`,
// and `renameFiles`. Worker 65 added optional `flags` (passed to the
// `RegExp` ctor as the second arg) and `sample` (UI-only documentation
// the runtime ignores). Pre-flags templates still satisfy this type
// because both fields are optional.
export type RenameRegex = {
  pattern: string
  replacement: string
  flags?: string
  sample?: string
}

export const applyRenameRegex = (
  name: string,
  renameRegex: RenameRegex | undefined,
): string =>
  renameRegex
    ? name.replace(
        new RegExp(renameRegex.pattern, renameRegex.flags),
        renameRegex.replacement,
      )
    : name
