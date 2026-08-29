import { logAndRethrowPipelineError } from "@mux-magic/tools"
import { concatMap, from, map, toArray } from "rxjs"

import {
  findMusicAssistantLibraryAlbums,
  type MusicAssistantFetch,
  type MusicAssistantLibraryAlbum,
} from "../music/musicAssistant/musicAssistantApi.js"
import {
  type ScanAudioFilesScannedRecord,
  scanAudioFiles,
} from "./scanAudioFiles.js"

export type CompareMusicAssistantLibraryRecord = {
  album: string
  artist: string | null
  kind: "inMusicLibrary" | "notInMusicLibrary" | "untagged"
  musicAssistantAlbums: MusicAssistantLibraryAlbum[]
  sourceFilePaths: string[]
}

export type CompareMusicAssistantLibraryProps = {
  fetchImplementation?: MusicAssistantFetch
  isRecursive?: boolean
  recursiveDepth?: number
  sourcePath: string
}

type AlbumCandidate = {
  album: string
  artist: string | null
  sourceFilePaths: string[]
}

const getArtist = (record: ScanAudioFilesScannedRecord) =>
  record.tags.albumArtist ?? record.tags.artist ?? null

const getAlbumCandidates = (
  records: ScanAudioFilesScannedRecord[],
) =>
  records
    .filter(
      (record) =>
        (record.tags.album ?? "").trim().length > 0,
    )
    .filter(
      (record, index, allRecords) =>
        allRecords.findIndex(
          (comparisonRecord) =>
            comparisonRecord.tags.album ===
              record.tags.album &&
            getArtist(comparisonRecord) ===
              getArtist(record),
        ) === index,
    )
    .map(
      (record): AlbumCandidate => ({
        album: record.tags.album ?? "",
        artist: getArtist(record),
        sourceFilePaths: records
          .filter(
            (comparisonRecord) =>
              comparisonRecord.tags.album ===
                record.tags.album &&
              getArtist(comparisonRecord) ===
                getArtist(record),
          )
          .map(
            (comparisonRecord) => comparisonRecord.filePath,
          ),
      }),
    )

const getUntaggedRecord = (
  records: ScanAudioFilesScannedRecord[],
): CompareMusicAssistantLibraryRecord[] =>
  records.some(
    (record) =>
      (record.tags.album ?? "").trim().length === 0,
  )
    ? [
        {
          album: "",
          artist: null,
          kind: "untagged",
          musicAssistantAlbums: [],
          sourceFilePaths: records
            .filter(
              (record) =>
                (record.tags.album ?? "").trim().length ===
                0,
            )
            .map((record) => record.filePath),
        },
      ]
    : []

export const compareMusicAssistantLibrary = ({
  fetchImplementation,
  isRecursive = true,
  recursiveDepth = 3,
  sourcePath,
}: CompareMusicAssistantLibraryProps) =>
  scanAudioFiles({
    isRecursive,
    recursiveDepth,
    sourcePath,
  }).pipe(
    map((records) =>
      records.filter(
        (record): record is ScanAudioFilesScannedRecord =>
          record.kind === "scanned",
      ),
    ),
    concatMap((records) =>
      from(getAlbumCandidates(records)).pipe(
        concatMap((candidate) =>
          from(
            findMusicAssistantLibraryAlbums({
              albumName: candidate.album,
              fetchImplementation,
            }),
          ).pipe(
            map(
              (
                musicAssistantAlbums,
              ): CompareMusicAssistantLibraryRecord => ({
                ...candidate,
                kind:
                  musicAssistantAlbums.length > 0
                    ? "inMusicLibrary"
                    : "notInMusicLibrary",
                musicAssistantAlbums,
              }),
            ),
          ),
        ),
        toArray(),
        map((recordsWithAlbums) =>
          recordsWithAlbums.concat(
            getUntaggedRecord(records),
          ),
        ),
      ),
    ),
    concatMap((records) => from(records)),
    logAndRethrowPipelineError(
      compareMusicAssistantLibrary,
    ),
  )
