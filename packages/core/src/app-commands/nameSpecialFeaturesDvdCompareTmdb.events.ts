import type { PossibleName } from "../tools/parseSpecialFeatures.js"

// A candidate association for an unnamed file — used in the follow-up
// association report when files remain unnamed after the main pass and
// there are untimed DVDCompare entries that could match them.
//
// `durationSeconds` carries the per-file runtime so the Smart Match modal
// (worker 58 / Part B) can rank candidates by duration proximity without
// re-probing /files/list at render time. Null when mediainfo couldn't
// resolve a duration for this file.
export type UnnamedFileCandidate = {
  filename: string
  durationSeconds: number | null
  candidates: string[]
}

// Per-rename emission shape. The pipeline emits one of these per file
// it actually renamed (`{ oldName, newName }`), then a single trailing
// summary record (`{ unrenamedFilenames, possibleNames, allKnownNames }`)
// so the builder can render "Files not renamed: …" plus an optional
// "Possible names (no timecode in listing): …" hint underneath, AND
// drive the autocomplete dropdown in the interactive renamer.
// `possibleNames` is `{ name, timecode? }[]` so the smart-suggestion
// modal (Option C) can rank candidates by duration proximity when a
// timecode is available; the field is empty whenever every file was
// successfully renamed.
// `allKnownNames` carries every extras label (timecoded + untimed) and
// cut name in DVDCompare-order so the UI's fuzzy autocomplete has the
// full set without re-parsing.
//
// The `collision` variant is only emitted in interactive (non-automated)
// mode when a rename target already exists on disk. The UI can render
// it as a "review needed" event prompting the user to compare and pick.
//
// The `movedToEditionFolder` variant is emitted after a main-feature
// file is successfully moved into its edition-aware nested folder.
export type NameSpecialFeaturesResult =
  | { oldName: string; newName: string }
  | {
      unrenamedFilenames: string[]
      possibleNames: PossibleName[]
      allKnownNames: string[]
      unnamedFileCandidates?: UnnamedFileCandidate[]
    }
  | {
      hasCollision: true
      filename: string
      targetFilename: string
    }
  | {
      hasMovedToEditionFolder: true
      filename: string
      destinationPath: string
    }
