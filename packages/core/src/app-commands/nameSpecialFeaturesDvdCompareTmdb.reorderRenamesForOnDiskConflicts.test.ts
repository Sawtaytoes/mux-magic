import type { FileInfo } from "@mux-magic/tools"
import { describe, expect, test } from "vitest"
import { reorderRenamesForOnDiskConflicts } from "./nameSpecialFeaturesDvdCompareTmdb.reorderRenamesForOnDiskConflicts.js"

const makeFileInfo = (filename: string): FileInfo => ({
  filename,
  fullPath: `/work/${filename}`,
  renameFile: () =>
    ({}) as ReturnType<FileInfo["renameFile"]>,
})

describe(reorderRenamesForOnDiskConflicts.name, () => {
  test("leaves the order untouched when no rename targets another file's current name", () => {
    const renames = [
      {
        fileInfo: makeFileInfo("MOVIE_t01.mkv"),
        renamedFilename: "Soldier (1998)",
      },
      {
        fileInfo: makeFileInfo("MOVIE_t02.mkv"),
        renamedFilename:
          "Behind the Scenes -behindthescenes",
      },
    ]
    expect(
      reorderRenamesForOnDiskConflicts(renames),
    ).toEqual(renames)
  })

  test("defers a rename whose target equals another rename's current filename (extension-stripped)", () => {
    // Reproduces the SOLDIER 4K race: a prior partial run left
    // "International Trailer without Narration -trailer.mkv" on disk;
    // this run renames that file to "with Narration" AND another file
    // to "without Narration". With concurrency >= 2 they raced; the
    // reorder ensures the file-renaming-away goes first.
    const renames = [
      // Conflicting rename — its target equals another rename's source
      {
        fileInfo: makeFileInfo("MOVIE_t12.mkv"),
        renamedFilename:
          "International Trailer without Narration -trailer",
      },
      // The file currently holding that name — needs to renaming first
      {
        fileInfo: makeFileInfo(
          "International Trailer without Narration -trailer.mkv",
        ),
        renamedFilename:
          "International Trailer with Narration -trailer",
      },
      {
        fileInfo: makeFileInfo("MOVIE_t05.mkv"),
        renamedFilename: "Featurette -featurette",
      },
    ]
    expect(
      reorderRenamesForOnDiskConflicts(renames).map(
        (rename) => rename.fileInfo.filename,
      ),
    ).toEqual([
      // Non-conflicting renames first
      "International Trailer without Narration -trailer.mkv",
      "MOVIE_t05.mkv",
      // Then the deferred conflicting rename
      "MOVIE_t12.mkv",
    ])
  })

  test("keeps an idempotent rename (target equals own current name) in the upfront group", () => {
    // A file whose target is its own name shouldn't be flagged as
    // conflicting with itself — the sourceStems set includes it, but
    // we explicitly skip the self-match.
    const renames = [
      {
        fileInfo: makeFileInfo("Already Named.mkv"),
        renamedFilename: "Already Named",
      },
    ]
    expect(
      reorderRenamesForOnDiskConflicts(renames),
    ).toEqual(renames)
  })
})
