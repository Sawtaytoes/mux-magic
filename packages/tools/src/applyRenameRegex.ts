export type RenameRegex = {
  pattern: string
  replacement: string
}

export const applyRenameRegex = (
  name: string,
  renameRegex: RenameRegex | undefined,
): string =>
  renameRegex
    ? name.replace(
        new RegExp(renameRegex.pattern),
        renameRegex.replacement,
      )
    : name
