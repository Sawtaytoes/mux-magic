import { join } from "node:path"
import type { MovieIdentity } from "../tools/canonicalizeMovieTitle.js"
import { parseEditionFromFilename } from "./nameSpecialFeaturesDvdCompareTmdb.editionTag.js"
import { buildMovieBaseName } from "./nameSpecialFeaturesDvdCompareTmdb.filename.js"
import { findSiblingsForEdition } from "./nameSpecialFeaturesDvdCompareTmdb.findSiblingsForEdition.js"

// A single planned file move within an edition-folder organization run.
export type EditionPlanMove = {
  sourceFilename: string
  destinationPath: string
  editionName: string
  isSibling: boolean
}

// Build the full list of planned moves for an edition-folder organization
// run, including sibling files (trailers, behind-the-scenes, etc.) that
// belong to each edition. The plan is emitted before any moves happen so
// the web UI can preview what is about to occur.
//
// Files with no edition tag are silently excluded from the plan.
export const buildEditionPlan = ({
  mainFeatureFilenames,
  allFilenamesInFolder,
  destinationBaseFolder,
  movie,
}: {
  mainFeatureFilenames: string[]
  allFilenamesInFolder: string[]
  sourceFolder: string
  destinationBaseFolder: string
  movie: MovieIdentity
}): EditionPlanMove[] => {
  const baseName = buildMovieBaseName(movie)

  return mainFeatureFilenames.flatMap(
    (mainFeatureFilename) => {
      const edition = parseEditionFromFilename(
        mainFeatureFilename,
      )
      if (!edition) {
        return [] as EditionPlanMove[]
      }
      const editionFolderName = `${baseName} {edition-${edition}}`
      const destinationDir = join(
        destinationBaseFolder,
        baseName,
        editionFolderName,
      )

      const siblings = findSiblingsForEdition({
        mainFeatureFilename,
        allFilenamesInFolder,
      })

      const mainMove: EditionPlanMove = {
        sourceFilename: mainFeatureFilename,
        destinationPath: join(
          destinationDir,
          mainFeatureFilename,
        ),
        editionName: edition,
        isSibling: false,
      }

      const siblingMoves: EditionPlanMove[] = siblings.map(
        (siblingFilename) => ({
          sourceFilename: siblingFilename,
          destinationPath: join(
            destinationDir,
            siblingFilename,
          ),
          editionName: edition,
          isSibling: true,
        }),
      )

      return [mainMove].concat(siblingMoves)
    },
  )
}
