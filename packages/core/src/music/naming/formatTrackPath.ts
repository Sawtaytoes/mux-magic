import { join } from "node:path"

import {
  DEFAULT_NAMING_OPTIONS,
  DEFAULT_NAMING_SCRIPT,
  type NamingOptions,
} from "./defaultNamingScript.js"
import { evaluatePicardScript } from "./picardScript.js"
import {
  replaceDirectorySeparators,
  sanitizePathSegment,
} from "./sanitizePathSegment.js"

export type TrackMetadata = {
  album?: string
  albumArtist?: string
  artist?: string
  date?: string
  discNumber?: string | number
  isMultiArtist?: boolean
  title?: string
  totalDiscs?: string | number
  totalTracks?: string | number
  trackNumber?: string | number
}

const toVariableValue = (
  value: string | number | undefined,
) =>
  value === undefined
    ? ""
    : replaceDirectorySeparators(String(value))

export const buildScriptVariables = (
  metadata: TrackMetadata,
) => ({
  _multiartist: metadata.isMultiArtist ? "1" : "",
  album: toVariableValue(metadata.album),
  albumartist: toVariableValue(metadata.albumArtist),
  artist: toVariableValue(metadata.artist),
  date: toVariableValue(metadata.date),
  discnumber: toVariableValue(metadata.discNumber),
  title: toVariableValue(metadata.title),
  totaldiscs: toVariableValue(metadata.totalDiscs),
  totaltracks: toVariableValue(metadata.totalTracks),
  tracknumber: toVariableValue(metadata.trackNumber),
})

export const formatTrackPath = ({
  libraryRoot,
  metadata,
  extension,
  namingOptions = DEFAULT_NAMING_OPTIONS,
  script = DEFAULT_NAMING_SCRIPT,
}: {
  libraryRoot: string
  metadata: TrackMetadata
  extension: string
  namingOptions?: NamingOptions
  script?: string
}) =>
  ((segments: string[]) =>
    join(libraryRoot, ...segments) + extension)(
    evaluatePicardScript({
      script,
      variables: buildScriptVariables(metadata),
    })
      .split("/")
      .map((segment) =>
        sanitizePathSegment({ segment, ...namingOptions }),
      ),
  )
