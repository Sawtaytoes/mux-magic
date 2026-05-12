import type { CommandField } from "../../commands/types"
import type { Step } from "../../types"

type TodoFieldProps = {
  type: string
  field: CommandField
  step: Step
}

export const TodoField = ({
  type,
  field,
}: TodoFieldProps) => (
  <div
    className="text-xs text-amber-400 italic py-0.5"
    data-todo-field-type={type}
  >
    [TodoField: {type} — {field.name}]
  </div>
)
