// Wave B placeholder — replace with full field rendering when Wave B lands.
// StepCard imports this so it typechecks; Wave B will fill in the real implementation.
import type { Step } from "../types"

interface RenderFieldsProps {
  step: Step
  stepIndex: number
}

export const RenderFields = ({
  step,
  stepIndex: _stepIndex,
}: RenderFieldsProps) => (
  <div className="text-xs text-slate-500 italic py-1">
    {step.command
      ? `[fields for ${step.command} — Wave B pending]`
      : null}
  </div>
)
