/** biome-ignore-all lint: planning sketch — not real handler code, just shape illustration */
// @ts-nocheck — planning sketch; not in any tsconfig
/* eslint-disable */

// =============================================================================
// SHAPE #1 — Per-file entry on EVERY command, coexisting with folder entry
// =============================================================================
//
// IDEA: Don't break the existing handler contract. Every command grows a
// SECOND, optional signature that processes ONE file at a time. The sequence
// runner picks which signature to call:
//
//   - Solo step / single-step job        → call the folder-level handler (old)
//   - Step inside a pipelined sequence   → call the per-file handler (new)
//
// Both contracts permanently coexist. Every command owns TWO functions forever
// (or sometimes one + shared helper). Maximum flexibility, maximum maintenance.

import {
  combineLatest,
  from,
  map,
  mergeMap,
  Observable,
  toArray,
} from "rxjs"

// -----------------------------------------------------------------------------
// 1. The shared per-file context handle (new for shape #1)
// -----------------------------------------------------------------------------

type FileContext = {
  // The current path of the file as it moves through the pipeline. A handler
  // that writes a transformed copy emits a NEW FileContext with the new path;
  // downstream handlers see the new path.
  fullPath: string
  // Free-form bag downstream handlers may read. e.g. copyFiles stamps the
  // original source path here so a later "deleteCopiedOriginals"-style step
  // knows what to clean up.
  metadata: Record<string, unknown>
}

// -----------------------------------------------------------------------------
// 2. Existing handler — UNCHANGED. Solo `runCommand` jobs still use this.
// -----------------------------------------------------------------------------

export const copyFiles = ({
  destinationPath,
  sourcePath,
}: {
  destinationPath: string
  sourcePath: string
}): Observable<{ source: string; destination: string }> => {
  // walks sourcePath, copies every file to destinationPath, emits per file
  return new Observable() // (folder-level impl as today)
}

// -----------------------------------------------------------------------------
// 3. NEW sibling per-file handler. Sequence runner calls this in pipelined mode.
// -----------------------------------------------------------------------------

export const copyFilesPerFile = ({
  destinationPath,
  fileContext,
}: {
  destinationPath: string
  fileContext: FileContext
}): Observable<FileContext> => {
  // Copy this ONE file. Emit the new FileContext pointing at the destination
  // so downstream steps process the copied file, not the original.
  return new Observable<FileContext>((subscriber) => {
    // ... aclSafeCopyFile(fileContext.fullPath, destPath) ...
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

// Same dual-signature pattern for mergeTracks, etc.
export const mergeTracksPerFile = ({
  fileContext,
  subtitlesPath,
}: {
  fileContext: FileContext
  subtitlesPath: string
}): Observable<FileContext> => {
  // run mkvmerge against fileContext.fullPath + matching subs folder
  return new Observable<FileContext>()
}

// -----------------------------------------------------------------------------
// 4. Command-registry entry gains an OPTIONAL `getPerFileObservable` field.
// -----------------------------------------------------------------------------

type CommandConfig = {
  getObservable: (
    params: Record<string, unknown>,
  ) => Observable<unknown>
  // OPTIONAL — only present on commands the user wants pipelined.
  getPerFileObservable?: (
    params: Record<string, unknown> & {
      fileContext: FileContext
    },
  ) => Observable<FileContext>
}

const commandConfigs: Record<string, CommandConfig> = {
  copyFiles: {
    getObservable: copyFiles,
    getPerFileObservable: copyFilesPerFile,
  },
  mergeTracks: {
    getObservable: () => new Observable(),
    getPerFileObservable: mergeTracksPerFile,
  },
  // some commands (naming, metadata-only checks) might NEVER ship a per-file
  // variant. Those steps can't appear inside a pipelined sequence.
}

// -----------------------------------------------------------------------------
// 5. Runner — keeps the existing await loop, ADDS a separate pipelined path
//    when the sequence opts in via `isPipelined: true`.
// -----------------------------------------------------------------------------

const runSequence = (
  sequence: any,
  filesSource$: Observable<FileContext>,
) => {
  if (sequence.isPipelined) {
    // PIPELINED PATH — every step must have getPerFileObservable
    return sequence.steps.reduce(
      (upstream$: Observable<FileContext>, step: any) =>
        upstream$.pipe(
          mergeMap((fileContext) =>
            commandConfigs[step.command]
              .getPerFileObservable!({
              ...step.params,
              fileContext,
            }),
          ),
        ),
      filesSource$,
    )
  }

  // OLD PATH — unchanged: await each step's observable to complete.
  return /* today's `for ... await runOneStep(step)` loop */ null
}

// -----------------------------------------------------------------------------
// 6. Example sequence body
// -----------------------------------------------------------------------------

const exampleSequence = {
  isPipelined: true, // <-- explicit opt-in per sequence
  pipelineSource: { sourcePath: "/source", depth: 0 },
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
// TRADE-OFFS
// =============================================================================
// + Existing handlers untouched. Single-step jobs and non-pipelined sequences
//   stay byte-identical to today.
// + Migration is incremental: ship per-file variants one command at a time.
// + Commands that conceptually can't be per-file (e.g. dedup across the whole
//   set) simply never get a per-file variant.
// - Permanent double maintenance: every command, every test fixture, twice.
// - The runtime has TWO step-execution paths to keep correct (cancellation,
//   error propagation, progress events, etc.).
// - "Which handler ran?" branches at every layer — debugger output gets noisier.
