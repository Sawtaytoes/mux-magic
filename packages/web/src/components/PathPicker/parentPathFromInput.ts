// Splits a partial path the user is typing into the `parentPath` to query and
// the `query` substring to filter children by. Shared by PathField and
// PathValueInput so the path-picker autocomplete sees the same contract.
//
// The bare-drive-letter case (`G:\` → parent `"G:"`) is the reason this lives
// in its own helper: `path.isAbsolute("G:")` is false on Windows (it's
// drive-relative), so the server rejects it. Preserving the trailing separator
// keeps the parent an absolute path.
export const parentPathFromInput = (
  rawValue: string,
): { parentPath: string; query: string } => {
  const lastSep = Math.max(
    rawValue.lastIndexOf("/"),
    rawValue.lastIndexOf("\\"),
  )
  const sliced =
    lastSep <= 0
      ? rawValue
      : rawValue.slice(0, lastSep) || "/"
  const parentPath = /^[A-Za-z]:$/.test(sliced)
    ? `${sliced}\\`
    : sliced
  const query = /[/\\]$/.test(rawValue)
    ? ""
    : rawValue.slice(lastSep + 1)
  return { parentPath, query }
}
