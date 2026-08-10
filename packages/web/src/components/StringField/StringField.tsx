import type { CommandField } from "../../commands/types"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import type { Step } from "../../types"
import { CommandFieldControl } from "../CommandFieldControl/CommandFieldControl"

type StringFieldProps = {
  field: CommandField
  step: Step
}

export const StringField = ({
  field,
  step,
}: StringFieldProps) => {
  const { setParam } = useBuilderActions()
  const value = step.params[field.name] ?? ""

  const handleInput = (
    event: React.FormEvent<HTMLInputElement>,
  ) => {
    const newValue = (event.target as HTMLInputElement)
      .value
    setParam(step.id, field.name, newValue || undefined)
  }

  return (
    <CommandFieldControl field={field}>
      <input
        type="text"
        defaultValue={String(value)}
        placeholder={field.placeholder ?? ""}
        onInput={handleInput}
        className="w-full bg-surface-sunken text-content-primary text-xs rounded px-2 py-1.5 border border-border-default focus:outline-none focus:border-border-focus"
      />
    </CommandFieldControl>
  )
}
