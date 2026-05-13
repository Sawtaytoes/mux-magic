import { spawn } from "node:child_process"
import { logAndSwallowPipelineError } from "@mux-magic/tools"
import { map, Observable } from "rxjs"
import { treeKillOnUnsubscribe } from "../cli-spawn-operations/treeKillChild.js"
import { mkvMergePath } from "./appPaths.js"
import { createTtyAffordances } from "./createTtyAffordances.js"
import type { Iso6392LanguageCode } from "./iso6392LanguageCodes.js"

export type Chapter = {
  num_entries: number
}

export type ContainerProperties = {
  container_type: number
  date_local: string
  date_utc: string
  duration: number
  is_providing_timestamps: boolean
  muxing_application: string
  segment_uid: string
  title: string
  writing_application: string
}

export type Container = {
  properties: ContainerProperties
  isRecognized: boolean
  isSupported: boolean
  type: string
}

export type TrackProperties = {
  audio_bits_per_sample?: number
  audio_channels?: number
  audio_sampling_frequency?: number
  codec_id: string
  codec_private_data?: string
  codec_private_length: number
  default_duration?: number
  isDefaultTrack: boolean
  display_dimensions?: string
  display_unit?: number
  isEnabledTrack: boolean
  isForcedTrack: boolean
  language: Iso6392LanguageCode | "und"
  minimum_timestamp?: number
  num_index_entries: number
  number: number
  packetizer?: string
  pixel_dimensions?: string
  track_name?: string
  uid: number
}

export type MkvTookNixTrackType =
  | "audio"
  | "subtitles"
  | "video"

export type Track = {
  codec: string
  id: number
  properties: TrackProperties
  type: MkvTookNixTrackType
}

export type MkvInfo = {
  attachments: unknown[]
  chapters: Chapter[]
  container: Container
  errors: unknown[]
  file_name: string
  global_tags: unknown[]
  identification_format_version: number
  track_tags: unknown[]
  tracks: Track[]
  warnings: unknown[]
}

export const getMkvInfo = (
  filePath: string,
): Observable<MkvInfo> =>
  new Observable<string>((observer) => {
    const commandArgs = [
      "--identification-format",
      "json",

      "--identify",
      `${filePath}`,
    ]

    console.info([mkvMergePath].concat(commandArgs), "\n")

    const childProcess = spawn(mkvMergePath, commandArgs)

    const tty = createTtyAffordances(childProcess)

    const chunks: Uint8Array[] = []
    // mkvmerge writes informational lines to stderr in some builds (e.g.
    // "Warning: …" on unusual-but-valid container quirks). Treating any
    // stderr byte as a fatal error tears the SSE stream / sequence runner
    // down mid-job for files that mkvmerge would otherwise identify just
    // fine — same shape of bug we already fixed in runMkvExtract.
    const stderrChunks: string[] = []

    childProcess.stdout.on("data", (chunk: Uint8Array) => {
      chunks.push(chunk)
    })

    childProcess.stderr.on("data", (chunk) => {
      const text = chunk.toString()
      stderrChunks.push(text)
      console.info(text)
    })

    childProcess.on("close", (code) => {
      if (code === null && tty.isUsingTtyAffordances) {
        setTimeout(() => {
          process.exit()
        }, 500)
      }
    })

    childProcess.on("exit", (code) => {
      tty.detach()

      if (code === 0) {
        const bufferOutput =
          Buffer.concat(chunks).toString("utf8")

        observer.next(
          bufferOutput.replace(
            /("codec_private_data"\s*:\s*)"[^"]*"/g,
            '$1""',
          ),
        )
        observer.complete()
        return
      }
      // code === null is the user-cancel path the 'close' handler
      // resolves. Anything else with captured stderr is a real failure
      // — surface it so the caller doesn't see an empty-tracks result
      // and silently skip the file.
      if (code !== null) {
        observer.error(
          new Error(
            `mkvmerge exited with code ${code}` +
              (stderrChunks.length
                ? `: ${stderrChunks.join("").trim()}`
                : ""),
          ),
        )
      }
    })

    // Kill the mkvmerge subtree on unsubscribe. Without this, a sequence
    // cancel or parallel-sibling fail-fast leaves identify-mode mkvmerge
    // running until it finishes (usually fast, but not always — large
    // attachments can stall it). Same teardown the streaming wrappers
    // (runMkvMerge, runMkvExtract, runMkvPropEdit, runFfmpeg) already use.
    return treeKillOnUnsubscribe(childProcess)
  }).pipe(
    map((mkvInfoJsonString) => {
      // mkvmerge's JSON uses snake_case for boolean track properties that
      // the TypeScript type renames to camelCase with is/has prefix. Map
      // them here so consumers use the idiomatic TypeScript names.
      const raw = JSON.parse(mkvInfoJsonString) as Record<
        string,
        unknown
      >
      const rawContainer = raw.container as Record<
        string,
        unknown
      >
      const rawTracks = raw.tracks as Array<
        Record<string, unknown>
      >
      return {
        ...raw,
        container: {
          ...rawContainer,
          isRecognized: rawContainer.recognized as boolean,
          isSupported: rawContainer.supported as boolean,
        },
        tracks: rawTracks.map((track) => {
          const rawProps = track.properties as Record<
            string,
            unknown
          >
          return {
            ...track,
            properties: {
              ...rawProps,
              isDefaultTrack:
                rawProps.default_track as boolean,
              isEnabledTrack:
                rawProps.enabled_track as boolean,
              isForcedTrack:
                rawProps.forced_track as boolean,
            },
          }
        }),
      } as MkvInfo
    }),
    logAndSwallowPipelineError(getMkvInfo),
  )
