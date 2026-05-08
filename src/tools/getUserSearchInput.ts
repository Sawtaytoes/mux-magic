import readline from "node:readline"
import { randomUUID } from "node:crypto"
import { Observable } from "rxjs"

import { getActiveJobId } from "../api/logCapture.js"
import { emitJobEvent } from "../api/jobStore.js"
import { cancelPrompt, registerPrompt } from "../api/promptStore.js"
import type { PromptOption } from "../api/types.js"

export const getUserSearchInput = (params: {
  message: string
  options: PromptOption[]
  // Forwarded to the SSE PromptEvent so the Builder's prompt modal can
  // render a ▶ Play button. Optional — only the per-file matcher prompts
  // know which file they're asking about; global prompts (search results)
  // omit it.
  filePath?: string
  // Forwarded to the SSE PromptEvent for multi-file prompts (e.g. the
  // duplicate-detection picker, where N files all map to the same target
  // name). Each entry pairs an option index with the file the option
  // represents so the UI can render a ▶ Play button per row. Independent
  // of `filePath` — `filePath` is for "preview the file being picked
  // FOR", while `filePaths` is for "preview the file each option IS".
  filePaths?: Array<{ index: number, path: string }>
}) => (
  new Observable<number>((observer) => {
    const jobId = getActiveJobId()

    if (jobId) {
      const promptId = randomUUID()

      emitJobEvent(jobId, {
        message: params.message,
        options: params.options,
        promptId,
        type: "prompt",
        filePath: params.filePath,
        filePaths: params.filePaths,
      })

      registerPrompt(promptId)
        .then((index) => {
          observer.next(index)
          observer.complete()
        })
        .catch((error: unknown) => {
          observer.error(error)
        })

      // TEMPORARY: teardown disabled to test the hypothesis that
      // 8a7749b's cancelPrompt-on-unsubscribe is firing prematurely
      // and causing the per-file matcher hang. If the hang stops
      // reproducing without this teardown, we'll either: (a) put it
      // back conditionally (only on actual cancel, not on natural
      // pipe complete), or (b) leave it off and accept the small
      // pendingPrompts leak as the cost of a working prompt flow.
      // return () => { cancelPrompt(promptId) }
      return
    }

    process.stdout.write(`${params.message}\n`)

    params.options.forEach((option) => {
      process.stdout.write(`${option.index} | ${option.label}\n`)
    })

    const readlineInterface = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    })

    readlineInterface.on("line", (line) => {
      readlineInterface.close()
      observer.next(Number(line))
      observer.complete()
    })
  })
)
