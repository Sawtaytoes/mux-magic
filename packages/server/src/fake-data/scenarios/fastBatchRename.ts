import { logInfo } from "@mux-magic/tools"
import { Observable } from "rxjs"
import { emitJobEvent } from "../../api/jobStore.js"
import { getActiveJobId } from "../../api/logCapture.js"

export type RenameItem = {
  source: string
  destination: string
}

// Emits all `items` as results over `totalMs`, ticking every ~tickMs with
// a progress event. Designed for rename-class commands where real-world
// I/O completes in a few hundred milliseconds — fast enough that the
// progress bar barely shows before the results appear.
export const fastBatchRenameScenario = (
  items: RenameItem[],
  options: { label?: string; totalMs?: number } = {},
): Observable<unknown> =>
  new Observable<unknown>((subscriber) => {
    const label = options.label ?? "fake/rename"
    const totalMs = options.totalMs ?? 250
    const jobId = getActiveJobId()
    const TICKS = 5
    const tickMs = Math.max(20, Math.floor(totalMs / TICKS))

    logInfo(label, `Found ${items.length} files to rename.`)

    let tick = 0
    const timer = setInterval(() => {
      tick++
      const ratio = tick / TICKS
      const filesDone = Math.round(ratio * items.length)
      const current =
        items[Math.min(filesDone, items.length - 1)]

      if (jobId) {
        emitJobEvent(jobId, {
          type: "progress",
          ratio,
          filesDone,
          filesTotal: items.length,
          currentFiles: current
            ? [{ path: current.source, ratio: 1.0 }]
            : [],
        })
      }

      if (tick >= TICKS) {
        clearInterval(timer)
        logInfo(label, `Renamed ${items.length} files.`)
        for (const item of items) subscriber.next(item)
        subscriber.complete()
      }
    }, tickMs)

    return () => clearInterval(timer)
  })
