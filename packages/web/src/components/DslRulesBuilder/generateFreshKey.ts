// Pick the first `<baseName>`, `<baseName>2`, `<baseName>3`, … not already in `usedNames`.
export const generateFreshKey = ({
  baseName,
  usedNames,
}: {
  baseName: string
  usedNames: Set<string>
}): string => {
  const buildCandidate = (suffixIndex: number) =>
    suffixIndex === 0 ? baseName : `${baseName}${suffixIndex + 1}`

  const found = Array.from({ length: 64 }, (_, position) => position).find(
    (suffixIndex) => !usedNames.has(buildCandidate(suffixIndex)),
  )

  if (found === undefined) {
    return `${baseName}${usedNames.size + 1}`
  }
  return buildCandidate(found)
}
