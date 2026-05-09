import {
  bufferCount,
  concatMap,
  filter,
  map,
  reduce,
} from "rxjs"

import { runMkvExtractStdOut } from "./runMkvExtractStdOut.js"

export const FALLBACK_TIMECODE = "00:00:00.000000000" as const

export const getChapters = (
  filePath: string,
) => (
  runMkvExtractStdOut({
    args: [
      "chapters",
      filePath,
    ],
  })
  .pipe(
    reduce(
      (
        combinedString,
        string,
      ) => (
        string === undefined
        ? combinedString
        : (
          combinedString
          .concat(
            string
          )
        )
      ),
      "",
    ),
    filter(
      Boolean
    ),
    concatMap((
      chaptersXmlString,
    ) => (
      (
        chaptersXmlString
        .replaceAll(
          "\r\n",
          "",
        )
        .match(
          /<ChapterAtom>(.+?)<\/ChapterAtom>/gm,
        )
      )
      || []
    )),
    map((
      chapterAtomString,
    ) => ({
      name: (
        chapterAtomString
        .match(
          /<ChapterString>(.+?)<\//gm,
        )
        ?.map((
          value,
        ) => (
          value
          .replace(
            /<ChapterString>(.+?)<\//gm,
            "$1",
          )
        ))
        .find(
          Boolean
        )
      ),
      timecodes: (
        chapterAtomString
        .match(
          /<ChapterTime(Start|End)>(.+?)<\//gm,
        )
        ?.map((
          value,
        ) => (
          value
          .replace(
            /<ChapterTime(Start|End)>(.+?)<\//gm,
            "$2",
          )
        ))
      ),
    })),
    map(({
      timecodes,
      ...otherProps
    }) => ({
      ...otherProps,
      endTimecode: (
        timecodes?.[1]
        || FALLBACK_TIMECODE
      ),
      startTimecode: (
        timecodes?.[0]
        || FALLBACK_TIMECODE
      ),
    })),
    // bufferCount(2),
    // map(([
    //   timecode,
    //   name,
    // ]) => ({
    //   name,
    //   timecode: (
    //     timecode
    //     .replace(
    //       /<ChapterTimeStart>/,
    //       "$1:$2:$3.$4",
    //     )
    //   ),
    // })),
  )
)
