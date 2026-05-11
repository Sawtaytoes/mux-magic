import type { CommandField } from "../../types"
import { FieldTooltip } from "../FieldTooltip/FieldTooltip"

type FieldLabelProps = {
  command: string
  field: Pick<
    CommandField,
    "name" | "label" | "required" | "description"
  >
}

export const FieldLabel = ({
  command,
  field,
}: FieldLabelProps) => (
  <label
    htmlFor={`${command}-${field.name}`}
    className="block text-xs text-slate-400 mb-1 cursor-help"
  >
    <FieldTooltip description={field.description ?? ""}>
      <span>
        {field.label ?? field.name}
        {field.required && (
          <span className="text-red-400"> *</span>
        )}
      </span>
    </FieldTooltip>
  </label>
)
