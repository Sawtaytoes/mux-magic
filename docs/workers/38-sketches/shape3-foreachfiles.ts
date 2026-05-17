/** biome-ignore-all lint: planning sketch — not real handler code, just shape illustration */
// @ts-nocheck — planning sketch; not in any tsconfig
/* eslint-disable */

// =============================================================================
// SHAPE #3 — New `forEachFiles` step kind; pipelining is opt-in per group
// =============================================================================
//
// IDEA: Don't touch the existing sequence contract for the 90% case. Add a NEW
// group kind in the DSL (parallel to worker 42's `forEachFolder`):
//
//   forEachFiles { sourcePath, depth, steps: [...] }
//
// INSIDE this group: per-file pipelining as the worker spec describes (file 1
// in step 3 while file 2 still in step 1). The runner discovers files once for
// this group and threads each FileContext through the group's steps via
// `mergeMap`.
//
// OUTSIDE this group: the runner is byte-identical to today. Folder-level
// handlers are unchanged. Solo steps unchanged.

import { mergeMap, Observable, toArray } from "rxjs"

// -----------------------------------------------------------------------------
// 1. Shared per-file context (same as shapes #1/#2 — only used INSIDE the group)
// -----------------------------------------------------------------------------

type FileContext = {
  fullPath: string
  metadata: Record<string, unknown>
}

// -----------------------------------------------------------------------------
// 2. Existing folder-level handlers — UNCHANGED (used outside the group)
// -----------------------------------------------------------------------------

export const copyFiles = ({
  destinationPath,
  sourcePath,
}: {
  destinationPath: string
  sourcePath: string
}): Observable<unknown> => new Observable() // (today's impl)

export const nameTvShowEpisodes = ({
  sourcePath,
}: {
  sourcePath: string
}): Observable<unknown> => new Observable() // (today's impl)

// -----------------------------------------------------------------------------
// 3. Per-file variants — ONLY for commands the user wants to use inside a
//    forEachFiles group. NOT every command needs one.
// -----------------------------------------------------------------------------

export const copyFilesPerFile = ({
  destinationPath,
  fileContext,
}: {
  destinationPath: string
  fileContext: FileContext
}): Observable<FileContext> => new Observable()

export const mergeTracksPerFile = ({
  fileContext,
  subtitlesPath,
}: {
  fileContext: FileContext
  subtitlesPath: string
}): Observable<FileContext> => new Observable()

// -----------------------------------------------------------------------------
// 4. Command-registry entry: per-file is OPTIONAL.
// -----------------------------------------------------------------------------

type CommandConfig = {
  getObservable: (
    params: Record<string, unknown>,
  ) => Observable<unknown>
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
  // nameTvShowEpisodes lives at the folder level only — it never needs to
  // appear inside a forEachFiles group (it names every file in the folder
  // based on collective metadata).
  nameTvShowEpisodes: { getObservable: nameTvShowEpisodes },
}

// -----------------------------------------------------------------------------
// 5. New step-kind alongside `step` and `group`.
// -----------------------------------------------------------------------------

type SequenceStep = {
  kind?: "step"
  command: string
  params: Record<string, unknown>
}

type SequenceParallelGroup = {
  kind: "group"
  isParallel: true
  steps: SequenceStep[]
}

type SequenceForEachFilesGroup = {
  kind: "forEachFiles"
  sourcePath: string
  depth?: number
  steps: SequenceStep[] // each command MUST have getPerFileObservable
}

type SequenceItem =
  | SequenceStep
  | SequenceParallelGroup
  | SequenceForEachFilesGroup

// -----------------------------------------------------------------------------
// 6. Runner — existing loop, ONE new branch for forEachFiles.
// -----------------------------------------------------------------------------

declare const getFilesAtDepth: (input: {
  sourcePath: string
  depth: number
}) => Observable<FileContext>
declare const runOneStep: (
  step: SequenceStep,
) => Promise<unknown>
declare const firstValueFrom: <T>(
  o: Observable<T>,
) => Promise<T>

const runSequence = async (items: SequenceItem[]) => {
  for (const item of items) {
    if ("kind" in item && item.kind === "forEachFiles") {
      // NEW BRANCH — pipelined per-file across this group's steps
      const files$ = getFilesAtDepth({
        sourcePath: item.sourcePath,
        depth: item.depth ?? 0,
      })

      const pipelined$ = item.steps.reduce(
        (upstream$: Observable<FileContext>, step) =>
          upstream$.pipe(
            mergeMap((fileContext) =>
              commandConfigs[step.command]
                .getPerFileObservable!({
                ...step.params,
                fileContext,
              }),
            ),
          ),
        files$,
      )

      // Group completes when every file has finished the last step.
      // toArray() here doesn't break streaming WITHIN the group — files
      // still race independently through the chain; the await just waits
      // for the LAST file to leave the LAST step before moving to the
      // next outer item.
      await firstValueFrom(pipelined$.pipe(toArray()))
      continue
    }

    // OTHER BRANCHES — unchanged from today
    if ("kind" in item && item.kind === "group") {
      // existing parallel-group handling
      continue
    }
    await runOneStep(item as SequenceStep)
  }
}

// -----------------------------------------------------------------------------
// 7. Example sequence body
// -----------------------------------------------------------------------------

const exampleSequence: SequenceItem[] = [
  // ordinary solo step — runs to completion, same as today
  {
    command: "copyFiles",
    params: {
      sourcePath: "/seed",
      destinationPath: "/staging",
    },
  },

  // pipelined group — file 1 hits mergeTracks while file 2 is still on copyFiles
  {
    kind: "forEachFiles",
    sourcePath: "/staging",
    depth: 0,
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
  },

  // back to ordinary — runs after the pipelined group's last file finishes
  {
    command: "nameTvShowEpisodes",
    params: { sourcePath: "/dest" },
  },
]

// =============================================================================
// TRADE-OFFS
// =============================================================================
// + Smallest blast radius — non-pipelined sequences behave EXACTLY as today.
// + Only commands the user actually puts inside a forEachFiles group need a
//   per-file variant. Migration is opt-in per command and per sequence.
// + The author of the YAML controls when pipelining is wanted, which means
//   commands like nameTvShowEpisodes (which need full-set knowledge) simply
//   stay outside the group — no awkward "stream-breaker" patterns required.
// + Composes naturally with worker 42's forEachFolder: forEachFolder iterates
//   folders, forEachFiles iterates files.
// - Two contracts permanently coexist (same as shape #1).
// - The worker spec's pseudocode (`sequence.steps.reduce(...)`) becomes
//   "group.steps.reduce(...)" — close but not identical to the spec.
// - Users must learn a new DSL construct to get the benefit.
