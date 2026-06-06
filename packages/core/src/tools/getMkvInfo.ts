import { spawn } from "node:child_process"
import {
  logAndSwallowPipelineError,
  logInfo,
} from "@mux-magic/tools"
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

    logInfo(
      "MKVMERGE IDENTIFY",
      [mkvMergePath].concat(commandArgs).join(" "),
    )

    const childProcess = spawn(mkvMergePath, commandArgs)

    // Without an 'error' listener, a spawn failure (ENOENT when mkvmerge
    // isn't on PATH, EACCES, etc.) bubbles to process-level
    // uncaughtException and the server's crash handler exits the process.
    // Same guard runAudioOffsetFinder already carries — route it through
    // the observer so the file is marked failed instead.
    childProcess.on("error", (err) => {
      observer.error(err)
    })

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
      logInfo("MKVMERGE IDENTIFY", text)
    })

    // Assemble + emit in 'close', NOT 'exit'. 'exit' fires the moment the
    // child terminates, but stdout's pipe is drained asynchronously by
    // libuv and its 'data' events can still be pending — reading `chunks`
    // there races the drain and yields an empty/truncated buffer, which
    // surfaces downstream as JSON.parse "Unexpected end of JSON input".
    // 'close' is emitted only after every stdio stream has hit EOF, so the
    // buffer is guaranteed complete. Under a burst of parallel identifies
    // the event loop is saturated and the race loses consistently, which
    // is why every file failed rather than just some.
    childProcess.on("close", (code) => {
      tty.detach()

      // code === null is the user-cancel path: the process was killed by a
      // signal (treeKill on unsubscribe). Finish without emitting.
      if (code === null) {
        if (tty.isUsingTtyAffordances) {
          setTimeout(() => {
            process.exit()
          }, 500)
        }
        return
      }

      if (code !== 0) {
        observer.error(
          new Error(
            `mkvmerge exited with code ${code}` +
              (stderrChunks.length
                ? `: ${stderrChunks.join("").trim()}`
                : ""),
          ),
        )
        return
      }

      const bufferOutput =
        Buffer.concat(chunks).toString("utf8")

      // mkvmerge exited 0 but produced nothing on stdout — there's no JSON
      // to parse. Surface a clear error rather than letting the empty
      // string reach JSON.parse and throw a cryptic SyntaxError.
      if (bufferOutput.trim() === "") {
        observer.error(
          new Error(
            "mkvmerge exited 0 but produced no output" +
              (stderrChunks.length
                ? `: ${stderrChunks.join("").trim()}`
                : ""),
          ),
        )
        return
      }

      observer.next(
        bufferOutput.replace(
          /("codec_private_data"\s*:\s*)"[^"]*"/g,
          '$1""',
        ),
      )
      observer.complete()
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
