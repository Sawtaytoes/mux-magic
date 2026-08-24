import { Button } from "@charcuterie/ui"
import { useSetAtom } from "jotai"

import { tagMatchModalAtom } from "../TagMatchModal/tagMatchModalAtom"
import type { TagMatchFile } from "../TagMatchModal/tagMatchTypes"
import { countMusicMatchFiles } from "./findMusicMatchResults"

// Post-run report for a `matchMusicBrainzRelease` job, and the only door
// into the tag review table. Mirrors `NsfRunResults` exactly: counts, then
// a trigger that seeds the modal atom with the server's already-ranked
// rows.
//
// Presentational only — the hosting component subscribes to the job's SSE
// stream, derives the clusters from `payload.results` at `isDone`, and
// resolves the linked `sourcePath`.
//
// The match command writes nothing. Everything this panel offers is a
// review step, which is the whole reason the command and the write are
// separate: `docs/picard-parity.md` §7.6 records that a blind run was
// rejected and the tag difference view is the replacement.

type Props = {
  files: TagMatchFile[]
  jobId: string
  sourcePath: string | null
  stepId: string
}

export const MusicMatchRunResults = ({
  files,
  jobId,
  sourcePath,
  stepId,
}: Props) => {
  const setTagMatch = useSetAtom(tagMatchModalAtom)

  if (files.length === 0) {
    return null
  }

  const counts = countMusicMatchFiles(files)

  const openTagMatch = () => {
    if (sourcePath === null) {
      return
    }
    setTagMatch({
      files,
      jobId,
      sourcePath,
      stepId,
    })
  }

  return (
    <div
      id="music-match-run-results"
      className="flex flex-col gap-2"
    >
      <div
        data-music-match-counts
        className="flex flex-wrap items-center gap-2 text-xs text-content-secondary"
      >
        <span>
          {counts.fileCount} audio files.{" "}
          {counts.matchedFileCount} matched a release,{" "}
          {counts.unmatchedFileCount} did not.
        </span>
        {sourcePath !== null && (
          <Button
            id="tag-match-trigger"
            intent="accent"
            appearance="solid"
            size="sm"
            onClick={openTagMatch}
            title="Review the proposed tags for each file before anything is written"
          >
            🎵 Review Tags
          </Button>
        )}
      </div>
      {counts.unmatchedFileCount > 0 && (
        <div
          data-music-match-unmatched-list
          className="bg-intent-warning-surface border border-intent-warning-border text-intent-warning-content rounded px-2 py-1.5 text-xs"
        >
          <p className="font-medium mb-1">
            No release matched:
          </p>
          <div className="font-mono wrap-break-word">
            {files
              .filter(
                (file) =>
                  file.rankedCandidates.length === 0,
              )
              .map((file) => (
                <div key={file.filePath}>
                  {file.filename}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
