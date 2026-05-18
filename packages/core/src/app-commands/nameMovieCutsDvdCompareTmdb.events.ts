// Per-file emission shape for the movie-cuts pipeline. Narrower than the
// full NSF result: only two variants — a successful rename+move, or a
// skip when no DVDCompare cut matches the file's duration. There is no
// summary trailer, no unnamed-file fallback, and no duplicate-prompt
// branch because this command's whole premise is "main feature only,
// match-or-skip, never guess".
//
// `destinationPath` is the final on-disk location after the edition-
// folder move. It always equals
//   <sourceParent>/<Title (Year)>/<Title (Year) {edition-<Cut>}>/<file>
// — never the in-place rename path — because the move is mandatory in
// this command. Special-features sibling commands keep the in-place
// path as a separate event variant; this command doesn't have one.
export type NameMovieCutsResult =
  | {
      oldName: string
      newName: string
      destinationPath: string
    }
  | {
      skippedFilename: string
      reason: "no_cut_match"
    }
