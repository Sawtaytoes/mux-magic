// Types owned by PromptModal — the modal that surfaces interactive
// prompts emitted by a running job (e.g. "Pick which audio track to keep").
//
// PromptOption is defined server-side (shared API contract); the rest
// are UI-only and live here.

import type { PromptOption } from "@media-tools/server/api-types"

export type { PromptOption }

export type PromptFilePath = {
  index: number
  path: string
}

export type PromptData = {
  jobId: string
  promptId: string
  message: string
  filePath?: string
  filePaths?: PromptFilePath[]
  options: PromptOption[]
}
