import type { CommandField, Step } from "../../types"
import { DslRulesBuilder } from "../DslRulesBuilder/DslRulesBuilder"
import { FieldLabel } from "../FieldLabel/FieldLabel"

type SubtitleRulesFieldProps = {
  field: CommandField
  step: Step
}

export const SubtitleRulesField = ({
  field,
  step,
}: SubtitleRulesFieldProps) => (
  <div className="mb-2">
    <FieldLabel command={step.command} field={field} />
    <DslRulesBuilder step={step} />
  </div>
)
