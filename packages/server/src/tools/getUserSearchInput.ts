import { randomUUID } from "node:crypto"
import readline from "node:readline"
import { Observable } from "rxjs"
import { emitJobEvent } from "../api/jobStore.js"
import { getActiveJobId } from "../api/logCapture.js"
import {
  cancelPrompt,
  registerPrompt,
} from "../api/promptStore.js"
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
  filePaths?: Array<{ index: number; path: string }>
}) =>
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

      let isResolved = false

      registerPrompt(promptId)
        .then((index) => {
          isResolved = true
          observer.next(index)
          observer.complete()
        })
        .catch((error: unknown) => {
          observer.error(error)
        })

      // Only cancel if the chain was externally unsubscribed (job
      // cancelled, parallel sibling failed, etc.) — not after natural
      // completion, where resolvePrompt already deleted the entry.
      return () => {
        if (!isResolved) cancelPrompt(promptId)
      }
    }

    process.stdout.write(`${params.message}\n`)

    params.options.forEach((option) => {
      process.stdout.write(
        `${option.index} | ${option.label}\n`,
      )
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
