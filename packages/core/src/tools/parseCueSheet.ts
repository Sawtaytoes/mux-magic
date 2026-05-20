// Pure CUE-sheet parser. Produces a discriminated union — callers
// branch on `kind` to decide between continuing the split pipeline and
// surfacing a clear error.
//
// CDDA INDEX timestamp format is MM:SS:FF where FF is 1/75 s (a "frame"
// in CD-DA terms, not a video frame). The split boundary is always
// INDEX 01 — INDEX 00 (pregap) is discarded per worker-75 spec.

export type CueTrack = {
  number: number
  title: string
  performer?: string
  startFrame: number
}

export type CueSheetOk = {
  kind: "ok"
  audioFileHint: string | null
  tracks: CueTrack[]
}

export type CueSheetError = {
  kind: "error"
  reason: "empty" | "multiFile" | "missingIndex"
}

export type ParsedCueSheet = CueSheetOk | CueSheetError

const fileLineRegex = /^\s*FILE\s+"([^"]+)"/i
const trackLineRegex = /^\s*TRACK\s+(\d+)\s+AUDIO/i
const titleLineRegex = /^\s*TITLE\s+"([^"]*)"/i
const performerLineRegex = /^\s*PERFORMER\s+"([^"]*)"/i
const indexLineRegex =
  /^\s*INDEX\s+(\d+)\s+(\d+):(\d+):(\d+)/i

type TrackAccumulator = {
  number: number
  title: string
  performer?: string
  startFrame?: number
}

const toCueTrack = (
  accumulator: TrackAccumulator,
): CueTrack | null => {
  if (accumulator.startFrame === undefined) return null
  return {
    number: accumulator.number,
    title: accumulator.title,
    performer: accumulator.performer,
    startFrame: accumulator.startFrame,
  }
}

export const parseCueSheet = (
  text: string,
): ParsedCueSheet => {
  if (text.trim() === "") {
    return { kind: "error", reason: "empty" }
  }

  const lines = text.split(/\r?\n/)

  type FoldState = {
    audioFileHint: string | null
    fileCount: number
    currentTrack: TrackAccumulator | null
    finalizedTracks: CueTrack[]
    hasMissingIndex: boolean
  }

  const initialState: FoldState = {
    audioFileHint: null,
    fileCount: 0,
    currentTrack: null,
    finalizedTracks: [],
    hasMissingIndex: false,
  }

  const finalState = lines.reduce<FoldState>(
    (state, line) => {
      const fileMatch = fileLineRegex.exec(line)
      if (fileMatch) {
        return {
          ...state,
          audioFileHint:
            state.audioFileHint ?? fileMatch[1],
          fileCount: state.fileCount + 1,
        }
      }

      const trackMatch = trackLineRegex.exec(line)
      if (trackMatch) {
        const flushedTracks =
          state.currentTrack === null
            ? state.finalizedTracks
            : (() => {
                const finalized = toCueTrack(
                  state.currentTrack,
                )
                return finalized === null
                  ? state.finalizedTracks
                  : state.finalizedTracks.concat(finalized)
              })()
        const isMissing =
          state.hasMissingIndex ||
          (state.currentTrack !== null &&
            state.currentTrack.startFrame === undefined)
        return {
          ...state,
          finalizedTracks: flushedTracks,
          hasMissingIndex: isMissing,
          currentTrack: {
            number: Number(trackMatch[1]),
            title: "",
          },
        }
      }

      if (state.currentTrack === null) return state

      const titleMatch = titleLineRegex.exec(line)
      if (titleMatch) {
        return {
          ...state,
          currentTrack: {
            ...state.currentTrack,
            title: titleMatch[1],
          },
        }
      }

      const performerMatch = performerLineRegex.exec(line)
      if (performerMatch) {
        return {
          ...state,
          currentTrack: {
            ...state.currentTrack,
            performer: performerMatch[1],
          },
        }
      }

      const indexMatch = indexLineRegex.exec(line)
      if (indexMatch) {
        const indexNumber = Number(indexMatch[1])
        if (indexNumber !== 1) return state
        const minutes = Number(indexMatch[2])
        const seconds = Number(indexMatch[3])
        const frames = Number(indexMatch[4])
        const startFrame =
          (minutes * 60 + seconds) * 75 + frames
        return {
          ...state,
          currentTrack: {
            ...state.currentTrack,
            startFrame,
          },
        }
      }

      return state
    },
    initialState,
  )

  const flushedFinal =
    finalState.currentTrack === null
      ? finalState.finalizedTracks
      : (() => {
          const finalized = toCueTrack(
            finalState.currentTrack,
          )
          return finalized === null
            ? finalState.finalizedTracks
            : finalState.finalizedTracks.concat(finalized)
        })()

  const hasMissingLastIndex =
    finalState.currentTrack !== null &&
    finalState.currentTrack.startFrame === undefined

  if (finalState.fileCount > 1) {
    return { kind: "error", reason: "multiFile" }
  }

  if (
    finalState.hasMissingIndex ||
    hasMissingLastIndex ||
    flushedFinal.length === 0
  ) {
    return flushedFinal.length === 0
      ? { kind: "error", reason: "empty" }
      : { kind: "error", reason: "missingIndex" }
  }

  return {
    kind: "ok",
    audioFileHint: finalState.audioFileHint,
    tracks: flushedFinal,
  }
}
