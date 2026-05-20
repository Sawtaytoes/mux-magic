import type { CommandField } from "../../commands/types"
import { FieldTooltip } from "../FieldTooltip/FieldTooltip"

type FieldLabelProps = {
  stepId: string
  field: Pick<
    CommandField,
    "name" | "label" | "isRequired" | "description"
  >
}

export const FieldLabel = ({
  stepId,
  field,
}: FieldLabelProps) => (
  <label
    htmlFor={`${stepId}-${field.name}`}
    className="block text-xs text-slate-400 mb-1 cursor-help"
  >
    <FieldTooltip description={field.description ?? ""}>
      <span>
        {field.label ?? field.name}
        {field.isRequired && (
          <span className="text-red-400"> *</span>
        )}
      </span>
    </FieldTooltip>
  </label>
)
