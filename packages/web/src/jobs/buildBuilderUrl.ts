import type { Job } from "../types"

const encodeSequenceAsUrl = (sequenceBody: unknown): string => {
  const json = JSON.stringify(sequenceBody)
  // unescape+encodeURIComponent converts Unicode to Latin-1 bytes for btoa.
  const b64 = btoa(unescape(encodeURIComponent(json)))
  return `/builder?seq=${b64}`
}

export const buildBuilderUrl = (job: Job): string => {
  if (job.commandName === "sequence" && job.params && typeof job.params === "object") {
    return encodeSequenceAsUrl(job.params)
  }
  return encodeSequenceAsUrl({
    paths: {},
    steps: [
      {
        id: "step1",
        command: job.commandName ?? job.command ?? "",
        params: job.params && typeof job.params === "object" ? job.params : {},
      },
    ],
  })
}
