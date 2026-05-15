import type { FileInfo } from "@mux-magic/tools"
import { stripExtension } from "./nameSpecialFeaturesDvdCompareTmdb.filename.js"

// Topological reorder: a rename whose target name equals another file's
// CURRENT name has to run AFTER that other file's rename completes —
// otherwise the OS rejects it ("File or folder already exists") and the
// downstream logAndSwallowPipelineError drops the file silently. Defer such renames
// to the end of the queue and run sequentially (concurrency: 1) so the
// freed-up slot is available by the time the deferred rename fires.
// Cycles (A→B, B→A) need a two-phase temp-rename pass to break the
// deadlock, but realistic disc-rip layouts don't produce them. The within-run
// duplicate-target counter ((2)/(3) prefix in the scan below) still
// kicks in on top of this for files matching the same extra.
export const reorderRenamesForOnDiskConflicts = <
  T extends { fileInfo: FileInfo; renamedFilename: string },
>(
  renames: T[],
): T[] => {
  const sourceStems = new Set(
    renames.map(({ fileInfo }) =>
      stripExtension(fileInfo.filename),
    ),
  )
  const upfront: T[] = []
  const deferred: T[] = []
  for (const rename of renames) {
    const ownStem = stripExtension(rename.fileInfo.filename)
    const isCollidingWithAnotherSource =
      sourceStems.has(rename.renamedFilename) &&
      rename.renamedFilename !== ownStem
    if (isCollidingWithAnotherSource) {
      deferred.push(rename)
    } else {
      upfront.push(rename)
    }
  }
  return [...upfront, ...deferred]
}
