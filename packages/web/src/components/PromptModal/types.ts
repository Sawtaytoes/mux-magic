// Types owned by PromptModal — the modal that surfaces interactive
// prompts emitted by a running job (e.g. "Pick which audio track to keep").
//
// PromptOption is defined server-side (shared API contract); the rest
// are UI-only and live here.

import type { PromptOption } from "@mux-magic/api/api-types"

export type { PromptOption }

export type PromptFilePath = {
  index: number
  path: string
}

export type PromptData = {
  jobId: string
  promptId: string
  message: string
  // Smaller caption rendered below `message`. Used to surface the
  // on-disk filename when `message` is a proposed new title — keeps
  // the headline distinct from the file context.
  subtitle?: string
  // Smaller caption rendered ABOVE `message`. Used to surface
  // hierarchical context (e.g. DVDCompare's parent section heading)
  // when `message` alone is ambiguous.
  context?: string
  filePath?: string
  filePaths?: PromptFilePath[]
  options: PromptOption[]
  // Closing the modal does NOT cancel the job — the server stays
  // suspended waiting for input. Setting `isMinimized: true` instead
  // of clearing the atom keeps the prompt data around so the StepCard
  // can surface a "paused" affordance and re-open the modal. A new
  // prompt event in useLogStream.ts overwrites the whole atom, so
  // isMinimized resets to undefined (falsy → visible) automatically.
  isMinimized?: boolean
}
