import {
  access,
  rename as fsRename,
  readdir,
} from "node:fs/promises"
import { basename, dirname, extname, join } from "node:path"
import { makeDirectory } from "@mux-magic/tools"
import {
  concatMap,
  defer,
  from,
  type Observable,
  of,
} from "rxjs"
import type { MovieIdentity } from "../tools/canonicalizeMovieTitle.js"
import { buildEditionPlan } from "./nameSpecialFeaturesDvdCompareTmdb.buildEditionPlan.js"
import {
  isMainFeatureFilename,
  parseEditionFromFilename,
} from "./nameSpecialFeaturesDvdCompareTmdb.editionTag.js"
import type { EditionPlanEvent } from "./nameSpecialFeaturesDvdCompareTmdb.events.js"
import { buildMovieBaseName } from "./nameSpecialFeaturesDvdCompareTmdb.filename.js"
import { findSiblingsForEdition } from "./nameSpecialFeaturesDvdCompareTmdb.findSiblingsForEdition.js"

// Find a unique target path by appending (2), (3), … until a path that
// does not already exist on disk is found. Returns the first free path.
export const findUniqueTargetPath = (
  desiredPath: string,
): Promise<string> => {
  const tryCandidate = (
    candidate: string,
    counter: number,
  ): Promise<string> =>
    access(candidate)
      .then(() => {
        // File exists — try next counter suffix.
        const extension = extname(desiredPath)
        const stem = desiredPath.slice(
          0,
          desiredPath.length - extension.length,
        )
        return tryCandidate(
          `${stem} (${counter})${extension}`,
          counter + 1,
        )
      })
      .catch(() => candidate)

  return tryCandidate(desiredPath, 2)
}

// Result type for a successful edition-folder move.
export type MovedToEditionFolderResult = {
  hasMovedToEditionFolder: true
  filename: string
  destinationPath: string
}

// Result type when a same-name file already exists in the destination
// edition folder — the move is skipped to avoid overwriting.
export type EditionFolderCollisionResult = {
  hasEditionFolderCollision: true
  filename: string
  destinationPath: string
  existingPath: string
}

// Union of all result types from `moveFileToEditionFolder`.
// `null` is returned when the file has no edition tag (no-op).
export type MoveToEditionFolderResult =
  | MovedToEditionFolderResult
  | EditionFolderCollisionResult

// Check whether a destination folder has a file with the same name as
// the file we're about to move in. Returns true only when a same-name
// file exists (collision). Returns false when the folder doesn't exist,
// is empty, or has only different files.
const hasDestinationCollision = ({
  destinationDir,
  filename,
}: {
  destinationDir: string
  filename: string
}): Promise<boolean> =>
  readdir(destinationDir)
    .then((existingFilenames) =>
      existingFilenames.some(
        (existingFilename) => existingFilename === filename,
      ),
    )
    .catch(() => false)

// Move a single file into its edition-aware nested folder:
//   <sourceParent>/<title> (<year>)/<title> (<year>) {edition-…}/<file>
//
// When the renamed file has no edition tag the move is skipped (returns
// null). Emits a collision event when the destination already holds a
// file with the same name. Emits a success event after moving.
export const moveFileToEditionFolder = ({
  sourceFilePath,
  movie,
}: {
  sourceFilePath: string
  movie: MovieIdentity
}): Observable<MoveToEditionFolderResult | null> => {
  const filename = basename(sourceFilePath)
  const edition = parseEditionFromFilename(filename)
  if (!edition) {
    return of(null)
  }

  const baseName = buildMovieBaseName(movie)
  const editionFolderName = `${baseName} {edition-${edition}}`
  const sourceParent = dirname(dirname(sourceFilePath))
  const destinationDir = join(
    sourceParent,
    baseName,
    editionFolderName,
  )
  const destinationPath = join(destinationDir, filename)

  return makeDirectory(destinationDir).pipe(
    concatMap(() =>
      defer(async () => {
        const isCollision = await hasDestinationCollision({
          destinationDir,
          filename,
        })
        if (isCollision) {
          const collisionResult: EditionFolderCollisionResult =
            {
              hasEditionFolderCollision: true,
              filename,
              destinationPath,
              existingPath: destinationPath,
            }
          return collisionResult as MoveToEditionFolderResult
        }
        await fsRename(sourceFilePath, destinationPath)
        const successResult: MovedToEditionFolderResult = {
          hasMovedToEditionFolder: true,
          filename,
          destinationPath,
        }
        return successResult as MoveToEditionFolderResult
      }),
    ),
  )
}

// Orchestrate the full edition-folder organization for a source folder.
// Reads the current contents of `sourcePath`, identifies every main
// feature with an `{edition-…}` tag and its Plex-suffix siblings, emits
// an `EditionPlanEvent` preview, then moves each file into the correct
// edition subfolder — emitting a result event per file.
//
// Returns an observable that emits:
//   1. One `EditionPlanEvent` (even if there are no edition files)
//   2. One `MoveToEditionFolderResult` per file moved or collided
export const organizeEditionFolders = ({
  sourcePath,
  movie,
}: {
  sourcePath: string
  movie: MovieIdentity
}): Observable<
  EditionPlanEvent | MoveToEditionFolderResult
> =>
  from(readdir(sourcePath)).pipe(
    concatMap((allFilenames) => {
      const mainFeatureFilenames = allFilenames.filter(
        (filename) =>
          isMainFeatureFilename(filename) &&
          parseEditionFromFilename(filename) !== null,
      )

      const plan = buildEditionPlan({
        mainFeatureFilenames,
        allFilenamesInFolder: allFilenames,
        sourceFolder: sourcePath,
        destinationBaseFolder: dirname(sourcePath),
        movie,
      })

      const planEvent: EditionPlanEvent = {
        isEditionPlan: true,
        moves: plan,
      }

      // Collect all filenames to move (main features + siblings per edition)
      const allFilesToMove = mainFeatureFilenames.flatMap(
        (mainFilename) => {
          const siblings = findSiblingsForEdition({
            mainFeatureFilename: mainFilename,
            allFilenamesInFolder: allFilenames,
          })
          return [mainFilename].concat(siblings)
        },
      )

      // Emit the plan first, then execute all moves sequentially
      return from([
        of<EditionPlanEvent>(planEvent),
        ...allFilesToMove.map((filename) =>
          moveFileToEditionFolder({
            sourceFilePath: join(sourcePath, filename),
            movie,
          }).pipe(
            concatMap(
              (
                moveResult,
              ): Observable<MoveToEditionFolderResult> =>
                moveResult === null
                  ? (of() as Observable<MoveToEditionFolderResult>)
                  : of(moveResult),
            ),
          ),
        ),
      ]).pipe(concatMap((observable) => observable))
    }),
  )
