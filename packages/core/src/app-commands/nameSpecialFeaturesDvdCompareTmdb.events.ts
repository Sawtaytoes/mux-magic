import type { PossibleName } from "../tools/parseSpecialFeatures.js"
import type { EditionPlanMove } from "./nameSpecialFeaturesDvdCompareTmdb.buildEditionPlan.js"
import type { ScoredCandidate } from "./nameSpecialFeaturesDvdCompareTmdb.rankCandidates.js"

// A candidate association for an unnamed file — used in the follow-up
// association report when files remain unnamed after the main pass.
//
// `rankedCandidates` is the duration-weighted scored output of
// `rankCandidatesForFile` (with worker 25's order tie-break applied).
// The Smart Match modal renders these directly — no client-side
// re-ranking — so confidence + per-signal scores match server intent
// byte-for-byte.
//
// `durationSeconds` carries the per-file runtime so the modal can show
// the measured runtime alongside each candidate's published timecode.
// Null when mediainfo couldn't resolve a duration for this file.
export type UnnamedFileCandidate = {
  filename: string
  // File extension including the dot (e.g. ".mkv"). Empty string when
  // the file has none. Needed because `filename` is already
  // extension-stripped at the FileInfo level (see
  // `getLastItemInFilePath` in `@mux-magic/tools`); without this slot
  // the Smart Match modal can't reconstruct the on-disk path for
  // `oldPath`/`newPath` and the rename fails with ENOENT.
  extension: string
  durationSeconds: number | null
  rankedCandidates: ScoredCandidate[]
}

// Preview event emitted before any edition-folder moves occur.
// Summarizes every planned move so the web UI can display a preview
// of what is about to happen (main features + their sibling files).
export type EditionPlanEvent = {
  isEditionPlan: true
  moves: EditionPlanMove[]
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
//
// The `hasEditionFolderCollision` variant is emitted when a same-name
// file already exists in the destination edition folder — the move is
// skipped to avoid overwriting.
//
// The `isEditionPlan` variant is emitted before any moves happen,
// summarizing all planned edition-folder moves (main features + siblings).
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
  | {
      hasEditionFolderCollision: true
      filename: string
      destinationPath: string
      existingPath: string
    }
  | EditionPlanEvent
