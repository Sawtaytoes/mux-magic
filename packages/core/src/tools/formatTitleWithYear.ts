/**
 * Add a release year to a title unless the upstream title already contains
 * that exact year as its final suffix.
 */
export const formatTitleWithYear = ({
  title,
  year,
}: {
  title: string
  year: string | undefined
}): string => {
  if (!year) return title

  const suffix = ` (${year})`
  return title.endsWith(suffix)
    ? title
    : `${title}${suffix}`
}
