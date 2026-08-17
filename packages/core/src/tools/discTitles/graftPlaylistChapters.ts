import {
  readFile,
  unlink,
  writeFile,
} from "node:fs/promises"
import { join } from "node:path"

import { logInfo } from "@mux-magic/tools"
import {
  concatMap,
  defer,
  map,
  type Observable,
} from "rxjs"

import { runMkvPropEdit } from "../../cli-spawn-operations/runMkvPropEdit.js"
import { buildSimpleChapters } from "../bluray/buildSimpleChapters.js"
import { parseMpls } from "../bluray/parseMpls.js"

/** Where a `[BACKUP]` folder keeps its playlists. */
const playlistFolderPath = join("BDMV", "PLAYLIST")

/**
 * Put a playlist's chapter marks onto a rip that has none.
 *
 * The raw `.m2ts` behind a playlist carries every track but no chapter
 * marks, which is the one thing that stops it being the cheap single-pass
 * rip source. The marks live in the `.mpls`, so they are parsed straight
 * out of the backup and written on.
 *
 * `mkvpropedit`, not `mkvmerge`: this rewrites the chapter element in
 * place instead of remuxing, which on a 65 GB feature is the difference
 * between a second and a full re-copy.
 */
export const graftPlaylistChapters = ({
  chapterSourceFileName,
  filePath,
  sourcePath,
}: {
  chapterSourceFileName: string
  filePath: string
  sourcePath: string
}): Observable<string> =>
  defer(() =>
    readFile(
      join(
        sourcePath,
        playlistFolderPath,
        chapterSourceFileName,
      ),
    ),
  ).pipe(
    map((bytes) =>
      buildSimpleChapters({ playlist: parseMpls(bytes) }),
    ),
    concatMap((simpleChapters) =>
      defer(async () => {
        const chaptersFilePath = `${filePath}.chapters.txt`

        await writeFile(
          chaptersFilePath,
          simpleChapters,
          "utf8",
        )

        logInfo(
          "GRAFT CHAPTERS",
          `${chapterSourceFileName} -> ${filePath}`,
          `${simpleChapters.split("\n").filter((line) => line.startsWith("CHAPTER") && !line.includes("NAME")).length} marks`,
        )

        return chaptersFilePath
      }),
    ),
    concatMap((chaptersFilePath) =>
      runMkvPropEdit({
        args: ["--chapters", chaptersFilePath],
        filePath,
      }).pipe(
        concatMap(() =>
          unlink(chaptersFilePath).then(() => filePath),
        ),
      ),
    ),
  )
