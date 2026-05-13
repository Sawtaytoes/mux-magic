import {
  getFilesAtDepth,
  logAndRethrowPipelineError,
  naturalSort,
} from "@mux-magic/tools"
import chalk from "chalk"
import {
  concatMap,
  filter,
  map,
  mergeMap,
  tap,
  toArray,
} from "rxjs"
import { filterIsVideoFile } from "../tools/filterIsVideoFile.js"
import { getUhdDiscForumPostData } from "../tools/getUhdDiscForumPostData.js"

export const hasBetterVersion = ({
  isRecursive,
  recursiveDepth = 1,
  sourcePath,
}: {
  isRecursive: boolean
  recursiveDepth: number
  sourcePath: string
}) =>
  getUhdDiscForumPostData().pipe(
    mergeMap((uhdDiscForumPostGroups) =>
      getFilesAtDepth({
        depth: isRecursive ? recursiveDepth : 0,
        sourcePath,
      }).pipe(
        filterIsVideoFile(),
        filter(
          (fileInfo) =>
            !/^.+ (-\w+)$/.test(fileInfo.filename),
        ),
        map((fileInfo) => ({
          movieName: fileInfo.filename.replace(
            /(.+) \(\d{4}\)/,
            "$1",
          ),
          movieNameWithYear: fileInfo.filename,
        })),
        map(({ movieName, movieNameWithYear }) => ({
          matchingSections: uhdDiscForumPostGroups
            .map(({ items, title }) => ({
              items: items.filter(
                ({
                  movieName: uhdDiscForumPostMovieName,
                }) =>
                  uhdDiscForumPostMovieName === movieName ||
                  uhdDiscForumPostMovieName ===
                    movieNameWithYear,
              ),
              sectionTitle: title,
            }))
            .filter(({ items }) => items.length > 0),
          movieNameWithYear,
        })),
        filter(
          ({ matchingSections }) =>
            matchingSections?.length > 0,
        ),
        toArray(),
        concatMap((items) =>
          naturalSort(items).asc(
            (item) => item.movieNameWithYear,
          ),
        ),
      ),
    ),
    map(({ matchingSections, ...otherProps }) => ({
      ...otherProps,
      matchingSections: matchingSections
        .map(({ items, sectionTitle }) =>
          chalk
            .blue(`  ${sectionTitle}`)
            .concat(
              "\n",
              items
                .map(({ publisher, reasons }) =>
                  chalk
                    .cyan(`    Publisher:`)
                    .concat(
                      ` ${publisher}`,
                      "\n",
                      reasons
                        ?.map((reason) => `    - ${reason}`)
                        .join("\n") ?? "",
                    ),
                )
                .find(Boolean) ?? "",
            ),
        )
        .join("\n\n"),
    })),
    tap(({ matchingSections, movieNameWithYear }) => {
      console.info(
        chalk.green(movieNameWithYear),
        `\n\n${matchingSections}\n\n`,
      )
    }),
    logAndRethrowPipelineError(hasBetterVersion),
  )
