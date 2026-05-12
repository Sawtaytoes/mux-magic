import { execFile as execFileCallback } from "node:child_process"
import { promisify } from "node:util"
import {
  catchError,
  defer,
  EMPTY,
  map,
  Observable,
  throwError,
} from "rxjs"

import { mediaInfoPath } from "./appPaths.js"
import type { Iso6391LanguageCode } from "./iso6391LanguageCodes.js"
import { logError } from "./logMessage.js"

const execFile = promisify(execFileCallback)

export type MediaInfoTrackType =
  | "Audio"
  | "General"
  | "Menu"
  | "Text"
  | "Video"

export type AudioExtra = {
  acmod?: string
  BedChannelConfiguration?: string
  BedChannelCount?: string
  bsid?: string
  ComplexityIndex?: string
  compr_Average?: string
  compr_Count?: string
  compr_Maximum?: string
  compr_Minimum?: string
  compr?: string
  dialnorm_Average?: string
  dialnorm_Minimum?: string
  dialnorm?: string
  dsurmod?: string
  dynrng_Average?: string
  dynrng_Count?: string
  dynrng_Maximum?: string
  dynrng_Minimum?: string
  dynrng?: string
  lfeon?: string
  NumberOfDynamicObjects?: string
  OriginalSourceMedium?: string
}

export type AudioTrack = {
  "@type": "Audio"
  "@typeorder"?: string
  BitDepth?: string
  BitRate_Maximum?: string
  BitRate_Mode: string
  BitRate: string
  ChannelLayout_Original: string
  ChannelLayout: string
  ChannelPositions: string
  Channels_Original: string
  Channels: string
  CodecID: string
  Compression_Mode: string
  Default: string
  Delay_Source: string
  Delay: string
  Duration: string
  extra: AudioExtra
  Forced: string
  Format_AdditionalFeatures?: string
  Format_Commercial_IfAny?: string
  Format_Commercial: string
  Format_Settings_Endianness?: string
  Format_Settings_Mode?: string
  Format: string
  FrameCount: string
  FrameRate_Den?: string
  FrameRate_Num?: string
  FrameRate: string
  ID: string
  Language?: Iso6391LanguageCode
  OriginalSourceMedium_ID?: string
  SamplesPerFrame: string
  SamplingCount: string
  SamplingRate: string
  ServiceKind?: string
  StreamOrder: string
  StreamSize: string
  Title?: string
  UniqueID: string
  Video_Delay: string
}

export type GenericExtra = {
  OriginalSourceMedium: string
}

export type GeneralTrack = {
  "@type": "General"
  AudioCount: string
  Duration: string
  Encoded_Application: string
  Encoded_Date: string
  Encoded_Library: string
  File_Created_Date_Local: string
  File_Created_Date: string
  File_Modified_Date_Local: string
  File_Modified_Date: string
  FileExtension: string
  FileSize: string
  Format_Version: string
  Format: string
  FrameCount: string
  FrameRate: string
  IsStreamable: string
  MenuCount?: string
  Movie?: string
  OverallBitRate_Mode?: string
  OverallBitRate: string
  StreamSize: string
  TextCount?: string
  Title?: string
  UniqueID: string
  VideoCount: string
}

export type MenuTrack = {
  "@type": "Menu"
  extra: Record<string, string>
}

export type TextTrack = {
  "@type": "Text"
  "@typeorder": string
  BitRate: string
  CodecID: string
  Default: string
  Duration: string
  ElementCount: string
  extra: GenericExtra
  Forced: string
  Format: string
  FrameCount: string
  FrameRate: string
  ID: string
  Language: Iso6391LanguageCode
  OriginalSourceMedium_ID: string
  StreamOrder: string
  StreamSize: string
  UniqueID: string
}

export type VideoTrack = {
  "@type": "Video"
  BitDepth: string
  BitRate_Maximum?: string
  BitRate_Mode?: string
  BitRate: string
  BufferSize?: string
  ChromaSubsampling_Position?: string
  ChromaSubsampling: string
  CodecID: string
  ColorSpace: string
  colour_description_present_Source?: string
  colour_description_present?: string
  colour_primaries_Source?: string
  colour_primaries?: string
  colour_range_Source?: string
  colour_range?: string
  Default: string
  Delay_Source: string
  Delay: string
  DisplayAspectRatio: string
  Duration: string
  extra?: GenericExtra
  Forced: string
  Format_Level: string
  Format_Profile: string
  Format_Settings_CABAC?: string
  Format_Settings_GOP?: string
  Format_Settings_RefFrames?: string
  Format_Tier?: string
  Format: string
  FrameCount: string
  FrameRate_Den: string
  FrameRate_Mode: string
  FrameRate_Num: string
  FrameRate: string
  HDR_Format_Compatibility?: string
  HDR_Format_Level?: string
  HDR_Format_Profile?: string
  HDR_Format_Settings?: string
  HDR_Format_Version?: string
  HDR_Format?: string
  Height: string
  ID: string
  Language?: Iso6391LanguageCode
  MasteringDisplay_ColorPrimaries_Source?: string
  MasteringDisplay_ColorPrimaries?: string
  MasteringDisplay_Luminance_Source?: string
  MasteringDisplay_Luminance?: string
  matrix_coefficients_Source?: string
  matrix_coefficients?: string
  MaxCLL_Source?: string
  MaxCLL?: string
  MaxFALL_Source?: string
  MaxFALL?: string
  OriginalSourceMedium_ID?: string
  PixelAspectRatio: string
  Sampled_Height: string
  Sampled_Width: string
  ScanType?: string
  Standard?: string
  Stored_Height?: string
  StreamOrder: string
  StreamSize: string
  transfer_characteristics_Source?: string
  transfer_characteristics?: string
  UniqueID: string
  Width: string
}

export type CreatingLibrary = {
  name: string
  url: string
  version: string
}

export type Media = {
  "@ref": string
  track: Array<
    | AudioTrack
    | GeneralTrack
    | MenuTrack
    | TextTrack
    | VideoTrack
  >
}

export type MediaInfo = {
  creatingLibrary: CreatingLibrary
  media: Media | null
}

// Wraps the mediainfo execFile in an AbortController-aware Observable so
// an unsubscribe (sequence cancel, parallel-sibling fail-fast) kills the
// in-flight subprocess instead of letting it run to completion. Node's
// child_process.execFile honours `{ signal }` natively — when the
// controller aborts, mediainfo gets SIGTERM and the underlying promise
// rejects with an AbortError that catchError-as-EMPTY will swallow.
export const getMediaInfo = (
  filePath: string,
): Observable<MediaInfo> =>
  new Observable<MediaInfo>((subscriber) => {
    const abortController = new AbortController()

    const innerSubscription = defer(() =>
      execFile(mediaInfoPath, ["--Output=JSON", filePath], {
        signal: abortController.signal,
      }),
    )
      .pipe(
        // execFile rejects with a non-null `code` on real failures, so we
        // don't need to throw on stderr presence — mediainfo is happy to
        // print warnings/info to stderr on healthy files. Throwing here was
        // the same shape of bug we fixed in runMkvExtract / getMkvInfo.
        map(({ stdout }) => stdout),
        map(
          (mediaInfoJsonString) =>
            JSON.parse(mediaInfoJsonString) as MediaInfo,
        ),
        catchError((error: unknown) => {
          const isAbortError =
            error instanceof Error &&
            error.name === "AbortError"
          if (isAbortError) return EMPTY

          const nodeError = error as {
            syscall?: string
          }
          if (nodeError.syscall === "spawn") {
            return throwError(() => error)
          }

          logError(getMediaInfo.name, error)
          return EMPTY
        }),
      )
      .subscribe(subscriber)

    return () => {
      abortController.abort()
      innerSubscription.unsubscribe()
    }
  })
