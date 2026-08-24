import { stat, utimes } from "node:fs/promises"
import { extname } from "node:path"
import {
  ByteVector,
  File,
  Id3v2FrameClassType,
  Id3v2FrameIdentifiers,
  Id3v2Tag,
  Id3v2UserTextInformationFrame,
  Mpeg4AppleDataBoxFlagType,
  Mpeg4AppleTag,
  Mpeg4BoxType,
  StringType,
  type Tag,
  TagTypes,
  XiphComment,
} from "node-taglib-sharp"
import type { AudioTags } from "./audioTagFields.js"

const ITUNES_MEAN_STRING = "com.apple.iTunes"

const PRIMARY_TAG_TYPE_BY_EXTENSION: Record<
  string,
  TagTypes
> = {
  ".aiff": TagTypes.Id3v2,
  ".ape": TagTypes.Ape,
  ".flac": TagTypes.Xiph,
  ".m4a": TagTypes.Apple,
  ".mka": TagTypes.Matroska,
  ".mp3": TagTypes.Id3v2,
  ".mp4": TagTypes.Apple,
  ".ogg": TagTypes.Xiph,
  ".opus": TagTypes.Xiph,
  ".wav": TagTypes.Id3v2,
  ".wv": TagTypes.Ape,
}

const getPrimaryTagType = (filePath: string) =>
  PRIMARY_TAG_TYPE_BY_EXTENSION[
    extname(filePath).toLowerCase()
  ]

const resolveWritableTag = ({
  audioFile,
  filePath,
}: {
  audioFile: File
  filePath: string
}) =>
  getPrimaryTagType(filePath) === undefined
    ? audioFile.tag
    : audioFile.getTag(
        getPrimaryTagType(filePath) as TagTypes,
        true,
      )

const applyStringField = ({
  assignValue,
  value,
}: {
  assignValue: (nextValue: string) => void
  value: string | undefined
}) => {
  if (value !== undefined) {
    assignValue(value)
  }
}

const applyStringListField = ({
  assignValues,
  value,
}: {
  assignValues: (nextValues: string[]) => void
  value: string | undefined
}) => {
  if (value !== undefined) {
    assignValues(value === "" ? [] : [value])
  }
}

const applyNumberField = ({
  assignValue,
  value,
}: {
  assignValue: (nextValue: number) => void
  value: number | undefined
}) => {
  if (value !== undefined) {
    assignValue(value)
  }
}

const applyBooleanField = ({
  assignValue,
  isEnabled,
}: {
  assignValue: (isNextValueEnabled: boolean) => void
  isEnabled: boolean | undefined
}) => {
  if (isEnabled !== undefined) {
    assignValue(isEnabled)
  }
}

const createUserTextFrame = ({
  description,
  value,
}: {
  description: string
  value: string
}) =>
  Object.assign(
    Id3v2UserTextInformationFrame.fromDescription(
      description,
    ),
    { text: [value] },
  )

const applyId3UserTextFrame = ({
  description,
  id3Tag,
  value,
}: {
  description: string
  id3Tag: Id3v2Tag
  value: string
}) => {
  id3Tag
    .getFramesByClassType<Id3v2UserTextInformationFrame>(
      Id3v2FrameClassType.UserTextInformationFrame,
    )
    .filter(
      (frame) =>
        frame.description.toLowerCase() ===
        description.toLowerCase(),
    )
    .forEach((frame) => {
      id3Tag.removeFrame(frame)
    })

  if (value !== "") {
    id3Tag.addFrame(
      createUserTextFrame({ description, value }),
    )
  }
}

const applyFreeformField = ({
  appleName,
  id3Description,
  tag,
  value,
  xiphKey,
}: {
  appleName: string
  id3Description: string
  tag: Tag
  value: string | undefined
  xiphKey: string
}) => {
  if (value !== undefined) {
    if (tag instanceof XiphComment) {
      tag.setFieldAsStrings(xiphKey, value)
    } else if (tag instanceof Id3v2Tag) {
      applyId3UserTextFrame({
        description: id3Description,
        id3Tag: tag,
        value,
      })
    } else if (tag instanceof Mpeg4AppleTag) {
      tag.setItunesStrings(
        ITUNES_MEAN_STRING,
        appleName,
        value,
      )
    }
  }
}

// taglib-sharp joins multi-value Apple strings with "; " when it writes
// them, so genres go in as one data box per genre to stay multi-value.
const applyGenresField = ({
  tag,
  values,
}: {
  tag: Tag
  values: string[] | undefined
}) => {
  if (values !== undefined) {
    if (tag instanceof Mpeg4AppleTag) {
      tag.setQuickTimeData(
        Mpeg4BoxType.GEN,
        values.map((genre) =>
          ByteVector.fromString(genre, StringType.UTF8),
        ),
        Mpeg4AppleDataBoxFlagType.ContainsText,
      )
    } else {
      tag.genres = values
    }
  }
}

const applyDateField = ({
  tag,
  value,
}: {
  tag: Tag
  value: string | undefined
}) => {
  if (value !== undefined) {
    if (tag instanceof XiphComment) {
      tag.setFieldAsStrings("DATE", value)
    } else if (tag instanceof Id3v2Tag) {
      tag.setTextFrame(Id3v2FrameIdentifiers.TDRC, value)
    } else if (tag instanceof Mpeg4AppleTag) {
      tag.setQuickTimeString(Mpeg4BoxType.DAY, value)
    } else {
      tag.year =
        value === ""
          ? 0
          : Number.parseInt(value.slice(0, 4), 10)
    }
  }
}

const applyAudioTags = ({
  tag,
  tags,
}: {
  tag: Tag
  tags: AudioTags
}) => {
  // Picard writes ID3v2.4 (write_id3v23=False); TDRC only exists there.
  if (tag instanceof Id3v2Tag) {
    tag.version = 4
  }

  applyStringField({
    assignValue: (nextValue) => {
      tag.title = nextValue
    },
    value: tags.title,
  })

  applyStringListField({
    assignValues: (nextValues) => {
      tag.performers = nextValues
    },
    value: tags.artist,
  })

  applyStringListField({
    assignValues: (nextValues) => {
      tag.albumArtists = nextValues
    },
    value: tags.albumArtist,
  })

  applyStringField({
    assignValue: (nextValue) => {
      tag.album = nextValue
    },
    value: tags.album,
  })

  applyNumberField({
    assignValue: (nextValue) => {
      tag.track = nextValue
    },
    value: tags.trackNumber,
  })

  applyNumberField({
    assignValue: (nextValue) => {
      tag.trackCount = nextValue
    },
    value: tags.totalTracks,
  })

  applyNumberField({
    assignValue: (nextValue) => {
      tag.disc = nextValue
    },
    value: tags.discNumber,
  })

  applyNumberField({
    assignValue: (nextValue) => {
      tag.discCount = nextValue
    },
    value: tags.totalDiscs,
  })

  applyDateField({ tag, value: tags.date })

  applyGenresField({ tag, values: tags.genres })

  applyStringListField({
    assignValues: (nextValues) => {
      tag.composers = nextValues
    },
    value: tags.composer,
  })

  applyStringField({
    assignValue: (nextValue) => {
      tag.comment = nextValue
    },
    value: tags.comment,
  })

  applyStringField({
    assignValue: (nextValue) => {
      tag.musicBrainzReleaseId = nextValue
    },
    value: tags.musicBrainzReleaseId,
  })

  applyStringField({
    assignValue: (nextValue) => {
      tag.musicBrainzTrackId = nextValue
    },
    value: tags.musicBrainzRecordingId,
  })

  applyStringField({
    assignValue: (nextValue) => {
      tag.musicBrainzArtistId = nextValue
    },
    value: tags.musicBrainzArtistId,
  })

  applyStringField({
    assignValue: (nextValue) => {
      tag.musicBrainzReleaseArtistId = nextValue
    },
    value: tags.musicBrainzAlbumArtistId,
  })

  applyStringField({
    assignValue: (nextValue) => {
      tag.musicBrainzReleaseGroupId = nextValue
    },
    value: tags.musicBrainzReleaseGroupId,
  })

  applyFreeformField({
    appleName: "Acoustid Fingerprint",
    id3Description: "Acoustid Fingerprint",
    tag,
    value: tags.acoustIdFingerprint,
    xiphKey: "ACOUSTID_FINGERPRINT",
  })

  applyFreeformField({
    appleName: "Acoustid Id",
    id3Description: "Acoustid Id",
    tag,
    value: tags.acoustIdId,
    xiphKey: "ACOUSTID_ID",
  })

  applyBooleanField({
    assignValue: (isNextValueEnabled) => {
      tag.isCompilation = isNextValueEnabled
    },
    isEnabled: tags.isCompilation,
  })
}

const applyTagsToAudioFile = ({
  filePath,
  isDryRun,
  tags,
}: {
  filePath: string
  isDryRun: boolean
  tags: AudioTags
}) => {
  const audioFile = File.createFromPath(filePath)
  const isFileSaved = !isDryRun

  try {
    applyAudioTags({
      tag: resolveWritableTag({ audioFile, filePath }),
      tags,
    })

    if (isFileSaved) {
      audioFile.save()
    }
  } finally {
    audioFile.dispose()
  }
}

export const writeAudioTags = ({
  filePath,
  isDryRun = false,
  isTimestampPreserved = true,
  tags,
}: {
  filePath: string
  isDryRun?: boolean
  isTimestampPreserved?: boolean
  tags: AudioTags
}) =>
  stat(filePath)
    .then((originalFileStats) =>
      Promise.resolve()
        .then(() => {
          applyTagsToAudioFile({ filePath, isDryRun, tags })
        })
        .then(() =>
          isTimestampPreserved
            ? utimes(
                filePath,
                originalFileStats.atime,
                originalFileStats.mtime,
              )
            : undefined,
        ),
    )
    .then(() => undefined)
    .catch((error: unknown) =>
      Promise.reject(
        new Error(
          `Cannot write audio tags to "${filePath}": ${
            error instanceof Error
              ? error.message
              : String(error)
          }`,
          { cause: error },
        ),
      ),
    )
