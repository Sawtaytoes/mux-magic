import { readFile, writeFile } from "node:fs/promises"
import { extname } from "node:path"
import {
  getFilesAtDepth,
  logAndRethrowPipelineError,
  logInfo,
} from "@mux-magic/tools"
import {
  concatMap,
  defer,
  EMPTY,
  filter,
  from,
  map,
  switchMap,
  tap,
  toArray,
} from "rxjs"
import {
  applyAssRules,
  buildFileMetadata,
  type FileBatchMetadata,
  filterRulesByWhen,
} from "../tools/applyAssRules.js"
import {
  parseAssFile,
  serializeAssFile,
} from "../tools/assFileTools.js"
import type {
  AssModificationRule,
  NamedPredicates,
} from "../tools/assTypes.js"
import { buildDefaultSubtitleModificationRules } from "../tools/buildDefaultSubtitleModificationRules.js"
import { withFileProgress } from "../tools/progressEmitter.js"

type ModifySubtitleMetadataRequiredProps = {
  isRecursive: boolean
  rules: AssModificationRule[]
  sourcePath: string
}

type ModifySubtitleMetadataOptionalProps = {
  hasDefaultRules?: boolean
  predicates?: NamedPredicates
  recursiveDepth?: number
}

export type ModifySubtitleMetadataProps =
  ModifySubtitleMetadataRequiredProps &
    ModifySubtitleMetadataOptionalProps

// Read + parse all .ass files in the source directory once. The resulting
// snapshots feed both `when:` predicate evaluation across the batch and
// `hasDefaultRules: true` heuristic computation. Returning the parsed
// AssFile alongside the metadata lets the per-file write step skip a
// second parse pass.
const readAndParseAssFiles = ({
  isRecursive,
  recursiveDepth,
  sourcePath,
}: {
  isRecursive: boolean
  recursiveDepth?: number
  sourcePath: string
}) =>
  getFilesAtDepth({
    depth: isRecursive ? recursiveDepth || 1 : 0,
    sourcePath,
  }).pipe(
    filter(
      (fileInfo) =>
        extname(fileInfo.fullPath).toLowerCase() === ".ass",
    ),
    concatMap((fileInfo) =>
      defer(() =>
        readFile(fileInfo.fullPath, "utf-8"),
      ).pipe(
        map((content) => {
          const assFile = parseAssFile(content)
          const fileMetadata = buildFileMetadata({
            assFile,
            filePath: fileInfo.fullPath,
          })
          return {
            assFile,
            fileMetadata,
            filePath: fileInfo.fullPath,
          }
        }),
      ),
    ),
    toArray(),
  )

export const modifySubtitleMetadata = ({
  hasDefaultRules,
  isRecursive,
  predicates,
  recursiveDepth,
  rules,
  sourcePath,
}: ModifySubtitleMetadataProps) => {
  const userRules = rules ?? []
  const isDefaultRulesEnabled = hasDefaultRules ?? false
  const namedPredicates = predicates ?? {}

  // Fast path so the YAML pipeline can always include a
  // modifySubtitleMetadata step. When neither user-supplied rules nor
  // hasDefaultRules are present there's nothing to do.
  if (!isDefaultRulesEnabled && userRules.length === 0) {
    logInfo(
      "MODIFY SUBTITLE METADATA",
      "No rules provided — skipping (no-op).",
    )
    return EMPTY
  }

  return readAndParseAssFiles({
    isRecursive,
    recursiveDepth,
    sourcePath,
  }).pipe(
    switchMap((parsedFiles) => {
      if (parsedFiles.length === 0) {
        logInfo(
          "MODIFY SUBTITLE METADATA",
          "No .ass files found — nothing to do.",
        )
        return EMPTY
      }

      const batchMetadata: FileBatchMetadata[] =
        parsedFiles.map(({ fileMetadata }) => fileMetadata)

      const defaultRules: AssModificationRule[] =
        isDefaultRulesEnabled
          ? buildDefaultSubtitleModificationRules(
              batchMetadata,
            )
          : []

      // Defaults run first so user rules can override them.
      const combinedRules = [...defaultRules, ...userRules]

      const activeRules = filterRulesByWhen({
        batchMetadata,
        predicates: namedPredicates,
        rules: combinedRules,
      })

      if (activeRules.length === 0) {
        logInfo(
          "MODIFY SUBTITLE METADATA",
          "All rules filtered out by `when:` predicates — no files written.",
        )
        return EMPTY
      }

      return from(parsedFiles).pipe(
        withFileProgress(
          ({ assFile, fileMetadata, filePath }) =>
            defer(() => {
              const updatedAssFile = applyAssRules({
                assFile,
                fileMetadata,
                rules: activeRules,
              })
              const updatedContent =
                serializeAssFile(updatedAssFile)
              return writeFile(
                filePath,
                updatedContent,
                "utf-8",
              )
            }).pipe(
              tap(() => {
                logInfo(
                  "MODIFIED SUBTITLE METADATA",
                  filePath,
                )
              }),
              // Per-file record so the API job's `results` is a useful list
              // of modified files instead of an array of nulls.
              map(() => ({ filePath })),
            ),
        ),
      )
    }),
    logAndRethrowPipelineError(modifySubtitleMetadata),
  )
}
