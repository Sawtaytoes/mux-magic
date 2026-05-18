import {
  access,
  rename as fsRename,
} from "node:fs/promises"
import { basename, dirname, extname, join } from "node:path"
import { makeDirectory } from "@mux-magic/tools"
import { concatMap, defer, type Observable, of } from "rxjs"
import type { MovieIdentity } from "../tools/canonicalizeMovieTitle.js"
import { parseEditionFromFilename } from "./nameSpecialFeaturesDvdCompareTmdb.editionTag.js"
import { buildMovieBaseName } from "./nameSpecialFeaturesDvdCompareTmdb.filename.js"

// Find a unique target path by appending (2), (3), … until a path that
// does not already exist on disk is found. Returns the first free path.
export const findUniqueTargetPath = async (
  desiredPath: string,
): Promise<string> => {
  let candidate = desiredPath
  let counter = 2
  while (true) {
    try {
      await access(candidate)
      // File exists — try next counter suffix.
      const ext = extname(desiredPath)
      const stem = desiredPath.slice(
        0,
        desiredPath.length - ext.length,
      )
      candidate = `${stem} (${counter})${ext}`
      counter++
    } catch {
      // access threw → file does NOT exist → this path is free.
      return candidate
    }
  }
}

// Move a single file into its edition-aware nested folder:
//   <sourceParent>/<title> (<year>)/<title> (<year>) {edition-…}/<file>
//
// When the renamed file has no edition tag the move is skipped (returns
// null). The caller emits a `movedToEditionFolder` result on success.
export const moveFileToEditionFolder = (
  renamedFilePath: string,
  movie: MovieIdentity,
): Observable<string | null> => {
  const filename = basename(renamedFilePath)
  const edition = parseEditionFromFilename(filename)
  if (!edition) return of(null)

  const baseName = buildMovieBaseName(movie)
  const editionFolderName = `${baseName} {edition-${edition}}`
  const sourceParent = dirname(dirname(renamedFilePath))
  const destinationDir = join(
    sourceParent,
    baseName,
    editionFolderName,
  )
  const destinationPath = join(destinationDir, filename)

  return makeDirectory(destinationDir).pipe(
    concatMap(() =>
      defer(async () => {
        const uniqueDestination =
          await findUniqueTargetPath(destinationPath)
        await fsRename(renamedFilePath, uniqueDestination)
        return uniqueDestination
      }),
    ),
  )
}
