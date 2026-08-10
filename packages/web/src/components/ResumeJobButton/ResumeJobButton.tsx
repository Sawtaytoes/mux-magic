import { buildBuilderUrl } from "../../jobs/buildBuilderUrl"
import type { Job } from "../../jobs/types"

interface ResumeJobButtonProps {
  job: Job
}

export const ResumeJobButton = ({
  job,
}: ResumeJobButtonProps) => (
  <a
    href={buildBuilderUrl(job)}
    target="_blank"
    rel="noopener noreferrer"
    title="Re-run this command in the Sequence Builder (cache from prior run carries forward)"
    className="text-xs px-2 py-0.5 rounded bg-intent-warning-surface text-intent-warning-content hover:bg-intent-warning-surface-hover"
  >
    ▶ Resume
  </a>
)
