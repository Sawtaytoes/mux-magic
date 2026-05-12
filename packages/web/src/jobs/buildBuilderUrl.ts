import type { Job } from "../jobs/types"

// Format decision (W5A): keep JSON rather than switching to YAML.
// JSON is ~20% smaller than the YAML equivalent (no indentation / key repetition).
// The ?seq= reader (BuilderPage.tsx) accepts both formats because JSON is valid YAML,
// so old share-URLs created by the legacy vanilla builder still load correctly.
const encodeSequenceAsUrl = (
  sequenceBody: unknown,
): string => {
  const json = JSON.stringify(sequenceBody)
  // unescape+encodeURIComponent converts Unicode to Latin-1 bytes for btoa.
  const b64 = btoa(unescape(encodeURIComponent(json)))
  return `/builder?seq=${b64}`
}

export const buildBuilderUrl = (job: Job): string => {
  if (
    job.commandName === "sequence" &&
    job.params &&
    typeof job.params === "object"
  ) {
    return encodeSequenceAsUrl(job.params)
  }
  return encodeSequenceAsUrl({
    paths: {},
    steps: [
      {
        id: "step1",
        command: job.commandName,
        params:
          job.params && typeof job.params === "object"
            ? job.params
            : {},
      },
    ],
  })
}
