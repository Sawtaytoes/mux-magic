import type { CommandField } from "../../commands/types"
import { FieldTooltip } from "../FieldTooltip/FieldTooltip"

type FieldLabelProps = {
  command: string
  field: Pick<
    CommandField,
    "name" | "label" | "isRequired" | "description"
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
        {field.isRequired && (
          <span className="text-red-400"> *</span>
        )}
      </span>
    </FieldTooltip>
  </label>
)
