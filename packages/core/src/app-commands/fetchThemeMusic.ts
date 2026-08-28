import {
  access,
  mkdir,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises"
import { basename, dirname, join } from "node:path"
import {
  catchError,
  concatMap,
  defer,
  from,
  map,
  mergeMap,
  of,
  toArray,
} from "rxjs"
import { runFfmpeg } from "../cli-spawn-operations/runFfmpeg.js"
import { getAnimeThemeWithMainShowFallback } from "../tools/animeThemesApi.js"

const ANIDB_FOLDER_ID = /\[anidb-(?<anidbId>\d+)]/i

type FetchThemeMusicRequiredProps = {
  sourcePath: string
}

type FetchThemeMusicOptionalProps = {
  isApplied?: boolean
  isOverwrite?: boolean
  manifestPath?: string
}

export type FetchThemeMusicProps =
  FetchThemeMusicRequiredProps &
    FetchThemeMusicOptionalProps

export type ThemeMusicManifestRecord = {
  anidbId: number | null
  audioUrl: string | null
  fallbackAnidbId: number | null
  hasExistingTheme: boolean
  path: string
  result:
    | "applied"
    | "missing-anidb-id"
    | "no-opening"
    | "planned"
    | "skipped-existing"
  showFolder: string
  slug: string | null
  song: string | null
  themeSource: "main-show" | "own" | null
}

const pathExists = async (filePath: string) =>
  access(filePath)
    .then(() => true)
    .catch(() => false)

const getShowFolders = async (sourcePath: string) => {
  const sourceStats = await stat(sourcePath)
  if (!sourceStats.isDirectory()) {
    throw new Error(
      `Theme source is not a directory: ${sourcePath}`,
    )
  }
  const sourceName = basename(sourcePath)
  if (ANIDB_FOLDER_ID.test(sourceName)) {
    return [sourcePath]
  }
  return (
    await readdir(sourcePath, { withFileTypes: true })
  )
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(sourcePath, entry.name))
    .toSorted((left, right) => left.localeCompare(right))
}

const getAnidbId = (showFolder: string) => {
  const match = ANIDB_FOLDER_ID.exec(basename(showFolder))
  return match?.groups?.anidbId === undefined
    ? null
    : Number(match.groups.anidbId)
}

const resolveTheme = async (showFolder: string) => {
  const anidbId = getAnidbId(showFolder)
  const themePath = join(showFolder, "theme.mp3")
  const hasExistingTheme = await pathExists(themePath)
  if (anidbId === null) {
    return {
      anidbId,
      audioUrl: null,
      fallbackAnidbId: null,
      hasExistingTheme,
      path: themePath,
      result: "missing-anidb-id" as const,
      showFolder,
      slug: null,
      song: null,
      themeSource: null,
    }
  }
  const theme =
    await getAnimeThemeWithMainShowFallback(anidbId)
  return theme === null
    ? {
        anidbId,
        audioUrl: null,
        fallbackAnidbId: null,
        hasExistingTheme,
        path: themePath,
        result: "no-opening" as const,
        showFolder,
        slug: null,
        song: null,
        themeSource: null,
      }
    : {
        anidbId,
        audioUrl: theme.audioUrl,
        fallbackAnidbId: theme.fallbackAnidbId,
        hasExistingTheme,
        path: themePath,
        result: "planned" as const,
        showFolder,
        slug: theme.slug,
        song: theme.song,
        themeSource: theme.source,
      }
}

const applyTheme = (record: ThemeMusicManifestRecord) => {
  if (record.audioUrl === null) {
    return of(record)
  }
  const audioUrl = record.audioUrl
  const sourceAudioPath = join(
    record.showFolder,
    ".theme-source.ogg",
  )
  const temporaryThemePath = join(
    record.showFolder,
    ".theme.mp3.part",
  )
  return defer(() =>
    fetch(audioUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `Theme audio download failed: ${response.status}`,
          )
        }
        return response.arrayBuffer()
      })
      .then((audio) =>
        writeFile(sourceAudioPath, Buffer.from(audio)),
      ),
  ).pipe(
    concatMap(() =>
      runFfmpeg({
        args: [
          "-vn",
          "-codec:a",
          "libmp3lame",
          "-b:a",
          "320k",
        ],
        inputFilePaths: [sourceAudioPath],
        outputFilePath: temporaryThemePath,
      }),
    ),
    concatMap(() =>
      from(rename(temporaryThemePath, record.path)),
    ),
    map(() => ({ ...record, result: "applied" as const })),
    catchError((error: unknown) =>
      from(
        Promise.all([
          rm(sourceAudioPath, { force: true }),
          rm(temporaryThemePath, { force: true }),
        ]),
      ).pipe(
        mergeMap(() => {
          throw error
        }),
      ),
    ),
    concatMap((appliedRecord) =>
      from(rm(sourceAudioPath, { force: true })).pipe(
        map(() => appliedRecord),
      ),
    ),
  )
}

export const fetchThemeMusic = ({
  isApplied = false,
  isOverwrite = true,
  manifestPath,
  sourcePath,
}: FetchThemeMusicProps) => {
  const resolvedManifestPath =
    manifestPath ??
    join(sourcePath, "theme-music-manifest.json")
  return defer(() => from(getShowFolders(sourcePath))).pipe(
    mergeMap((showFolders) => from(showFolders)),
    concatMap((showFolder) =>
      from(resolveTheme(showFolder)),
    ),
    concatMap((record) =>
      isApplied &&
      record.result === "planned" &&
      (isOverwrite || !record.hasExistingTheme)
        ? applyTheme(record)
        : of({
            ...record,
            result:
              record.result === "planned" &&
              record.hasExistingTheme &&
              !isOverwrite
                ? ("skipped-existing" as const)
                : record.result,
          }),
    ),
    toArray(),
    concatMap((records) =>
      from(
        mkdir(dirname(resolvedManifestPath), {
          recursive: true,
        }),
      ).pipe(
        concatMap(() =>
          from(
            writeFile(
              resolvedManifestPath,
              `${JSON.stringify(records, null, 2)}\n`,
              "utf8",
            ),
          ),
        ),
        map(() => records),
      ),
    ),
    mergeMap((records) => from(records)),
  )
}
