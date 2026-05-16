import { logInfo } from "@mux-magic/tools"
import {
  combineLatest,
  concatMap,
  endWith,
  filter,
  from,
  groupBy,
  map,
  mergeMap,
  of,
  skip,
  take,
  tap,
  toArray,
} from "rxjs"

import { getMkvInfo } from "../tools/getMkvInfo.js"
import { runMkvPropEdit } from "./runMkvPropEdit.js"

export const setOnlyFirstTracksAsDefault = ({
  filePath,
}: {
  filePath: string
}) =>
  getMkvInfo(filePath).pipe(
    concatMap(({ tracks }) =>
      combineLatest([
        // Does this file have subtitles?
        // We're assuming it has video and audio.
        from(tracks).pipe(
          filter(({ type }) => type === "subtitles"),
          map(() => true),
          endWith(false),
          take(1),
        ),

        // Are all first tracks marked as default?
        from(tracks).pipe(
          groupBy((track) => track.type),
          mergeMap((group$) => group$.pipe(take(1))),
          filter(
            (track) => !track.properties.isDefaultTrack,
          ),
          map(() => false),
          endWith(true),
          take(1),
        ),

        // Capture any non-first tracks marked as default.
        from(tracks).pipe(
          groupBy((track) => track.type),
          mergeMap((group$) =>
            group$.pipe(
              skip(1),
              filter(
                (track) => track.properties.isDefaultTrack,
              ),
            ),
          ),
          toArray(),
        ),
      ]).pipe(
        take(1),
        map(
          ([
            hasSubtitles,
            hasCorrectFirstTracks,
            wrongDefaultTracks,
          ]) => ({
            hasCorrectDefaultTracks:
              hasCorrectFirstTracks &&
              wrongDefaultTracks.length === 0,
            hasSubtitles,
            wrongDefaultTracks,
          }),
        ),
      ),
    ),
    concatMap(
      ({
        hasSubtitles,
        hasCorrectDefaultTracks,
        wrongDefaultTracks,
      }) =>
        hasCorrectDefaultTracks
          ? of(null)
          : runMkvPropEdit({
              args: [
                ...wrongDefaultTracks
                  .map(
                    ({ properties }) => properties.number,
                  )
                  .flatMap((trackId) => [
                    "--edit",
                    `track:@${trackId}`,

                    "--set",
                    "flag-default=0",
                  ]),

                // Video
                "--edit",
                `track:v1`,

                "--set",
                "flag-default=1",

                // Audio
                "--edit",
                `track:a1`,

                "--set",
                "flag-default=1",

                // Subtitles
                ...(hasSubtitles
                  ? [
                      "--edit",
                      `track:s1`,

                      "--set",
                      "flag-default=1",
                    ]
                  : []),
              ],
              filePath,
            }).pipe(
              tap(() => {
                if (wrongDefaultTracks.length > 0) {
                  logInfo(
                    "WRONG DEFAULT TRACKS",
                    filePath,
                    "Track IDs: ".concat(
                      wrongDefaultTracks
                        .map(({ properties, type }) =>
                          type.concat(
                            " ",
                            String(properties.number),
                          ),
                        )
                        .join(", "),
                    ),
                  )
                }
              }),
            ),
    ),
  )
