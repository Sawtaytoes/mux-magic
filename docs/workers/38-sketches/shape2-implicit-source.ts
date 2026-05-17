/** biome-ignore-all lint: planning sketch — not real handler code, just shape illustration */
// @ts-nocheck — planning sketch; not in any tsconfig
/* eslint-disable */

// =============================================================================
// SHAPE #2 — Implicit per-sequence `files$` source; per-file is the ONLY contract
// =============================================================================
//
// IDEA: Throw away the folder-level handler contract entirely. The SEQUENCE
// declares its file source up front (top-level `pipelineSource`). The runner
// discovers files ONCE and threads each FileContext through every step.
// Every command has exactly ONE signature: per-file.
//
// A "single-step job" becomes a sequence with one step + a pipelineSource of
// length 1 (or the single source file the route was called with).

import { mergeMap, Observable } from "rxjs"

// -----------------------------------------------------------------------------
// 1. The shared per-file context handle (same as shape #1)
// -----------------------------------------------------------------------------

type FileContext = {
  fullPath: string
  metadata: Record<string, unknown>
}

// -----------------------------------------------------------------------------
// 2. Handler — ONLY signature. No folder-level entry exists anymore.
//    Compare to shape #1: there is no `copyFiles({ sourcePath })`. The
//    sourcePath lives on the SEQUENCE, not the step.
// -----------------------------------------------------------------------------

export const copyFiles = ({
  destinationPath,
  fileContext,
}: {
  destinationPath: string
  fileContext: FileContext
}): Observable<FileContext> => {
  return new Observable<FileContext>((subscriber) => {
    // copy fileContext.fullPath → destinationPath/<basename>
    subscriber.next({
      fullPath: `${destinationPath}/whatever.mkv`,
      metadata: {
        ...fileContext.metadata,
        originalSource: fileContext.fullPath,
      },
    })
    subscriber.complete()
  })
}

export const mergeTracks = ({
  fileContext,
  subtitlesPath,
}: {
  fileContext: FileContext
  subtitlesPath: string
}): Observable<FileContext> => {
  // mkvmerge fileContext.fullPath + matching subs from subtitlesPath
  return new Observable<FileContext>()
}

// "Whole-set" handlers (dedup, sort) become STREAM-BREAKERS: they buffer
// upstream, do their thing, then emit each result. Same SIGNATURE; just
// internally they have to `toArray()` first.
export const hasDuplicateMusicFiles = ({
  fileContext,
}: {
  fileContext: FileContext
}): Observable<FileContext> => {
  // implementation buffers all upstream into a Map keyed by hash, then
  // emits any whose key appears more than once.
  return new Observable<FileContext>()
}

// -----------------------------------------------------------------------------
// 3. Command registry — ONE entry per command, ONE shape.
// -----------------------------------------------------------------------------

type CommandConfig = {
  // No folder-level signature. Period.
  getPerFileObservable: (
    params: Record<string, unknown> & {
      fileContext: FileContext
    },
  ) => Observable<FileContext>
}

const commandConfigs: Record<string, CommandConfig> = {
  copyFiles: { getPerFileObservable: copyFiles },
  mergeTracks: { getPerFileObservable: mergeTracks },
  hasDuplicateMusicFiles: {
    getPerFileObservable: hasDuplicateMusicFiles,
  },
}

// -----------------------------------------------------------------------------
// 4. Sequence body — `pipelineSource` is a REQUIRED top-level field.
//    There is no "non-pipelined" mode. Every sequence is a pipeline.
// -----------------------------------------------------------------------------

type SequenceBody = {
  pipelineSource: { sourcePath: string; depth: number }
  steps: Array<{
    command: string
    params: Record<string, unknown>
  }>
}

// -----------------------------------------------------------------------------
// 5. Runner — ONE path. No `await per step`, no fork between solo and pipelined.
//    Every sequence is a `reduce` over steps composing on top of files$.
// -----------------------------------------------------------------------------

declare const getFilesAtDepth: (input: {
  sourcePath: string
  depth: number
}) => Observable<FileContext>

const runSequence = (
  body: SequenceBody,
): Observable<FileContext> => {
  const files$ = getFilesAtDepth(body.pipelineSource)

  return body.steps.reduce(
    (upstream$, step) =>
      upstream$.pipe(
        mergeMap((fileContext) =>
          commandConfigs[step.command].getPerFileObservable(
            {
              ...step.params,
              fileContext,
            },
          ),
        ),
      ),
    files$,
  )
}

// -----------------------------------------------------------------------------
// 6. Example sequence body
// -----------------------------------------------------------------------------

const exampleSequence: SequenceBody = {
  pipelineSource: { sourcePath: "/source", depth: 0 }, // <-- required, not optional
  steps: [
    {
      command: "copyFiles",
      params: { destinationPath: "/dest" },
    },
    {
      command: "mergeTracks",
      params: { subtitlesPath: "/subs" },
    },
  ],
}

// =============================================================================
// HOW THIS DIFFERS FROM SHAPE #1
// =============================================================================
// Shape #1: each command has TWO functions; runner branches on isPipelined.
// Shape #2: each command has ONE function; runner has ONE code path.
//
// Shape #1: existing folder-level handlers stay forever; new per-file added.
// Shape #2: existing handlers are REWRITTEN to take FileContext. Nothing keeps
//           the old signature. Folder-discovery moves out of every handler and
//           up to the runner's single `getFilesAtDepth(body.pipelineSource)`.
//
// Shape #1: a sequence using a command WITHOUT a per-file variant is a runtime
//           error in pipelined mode (or you fall back to folder-level for that
//           step alone — extra branch).
// Shape #2: there is no "without". Every command MUST conform. If you can't
//           express a command per-file, you must make it a stream-breaker
//           (internal toArray + buffer).
//
// =============================================================================
// TRADE-OFFS
// =============================================================================
// + Cleanest model. One contract, one runner path, easy to reason about.
// + The pseudocode in the worker spec literally maps to this shape.
// + Cross-step pipelining is the default; no opt-in flag needed.
// - Every existing handler rewritten. Every test fixture rewritten. Sequence
//   YAML schema changes (new required top-level field). URL `?seq=` round-trip
//   needs a migration path for old payloads.
// - Folder-level callers (HTTP routes that hit a command directly, not as a
//   sequence) need an adapter that wraps a single source as a FileContext
//   stream of length-N to feed the per-file handler.
// - Commands that LEGITIMATELY operate at the folder/whole-set level (recursive
//   cp of a folder tree, mkvmerge join, "find duplicates across all files")
//   become stream-breakers with internal toArray — defeating the streaming win
//   for those steps. The model is correct; their semantics just require it.
