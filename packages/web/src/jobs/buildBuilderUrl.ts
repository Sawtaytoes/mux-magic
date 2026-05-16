import { encodeSeqJsonParam } from "./encodeSeqJsonParam"
import type { Job } from "./types"

// Format: minified JSON + base64url under `?seqJson=`. Worker 43 swapped
// the encoding from `btoa(unescape(encodeURIComponent(JSON.stringify(...))))`
// (with `+` and `/` then needing URL-escape) to base64url, which is a few
// bytes shorter and avoids the `encodeURIComponent` step entirely. JSON is
// valid YAML, so the BuilderPage reader still feeds the decoded payload
// straight into `loadYamlFromText`.
const encodeSequenceAsUrl = (
  sequenceBody: unknown,
): string =>
  `/builder?seqJson=${encodeSeqJsonParam(JSON.stringify(sequenceBody))}`

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
