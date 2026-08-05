import type { CommandField } from "../../commands/types"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import type { Step } from "../../types"
import { CommandFieldControl } from "../CommandFieldControl/CommandFieldControl"

type NumberFieldProps = {
  field: CommandField
  step: Step
}

export const NumberField = ({
  field,
  step,
}: NumberFieldProps) => {
  const { setParam } = useBuilderActions()
  const value =
    step.params[field.name] ?? field.default ?? ""
  const companion = field.companionNameField
    ? step.params[field.companionNameField]
    : null

  const handleInput = (
    event: React.FormEvent<HTMLInputElement>,
  ) => {
    const raw = (event.target as HTMLInputElement).value
    const parsed = raw === "" ? undefined : Number(raw)
    setParam(step.id, field.name, parsed)
  }

  return (
    <>
      <CommandFieldControl field={field}>
        <input
          type="number"
          defaultValue={value as number | string}
          placeholder={field.placeholder ?? ""}
          onInput={handleInput}
          className="w-full bg-surface-sunken text-content-primary text-xs rounded px-2 py-1.5 border border-border-default focus:outline-none focus:border-border-focus"
        />
      </CommandFieldControl>

      {field.companionNameField && Boolean(companion) && (
        <p
          data-step={step.id}
          data-companion={field.name}
          className="text-xs text-content-muted mt-0.5 truncate"
          title={String(companion)}
        >
          {String(companion)}
        </p>
      )}
    </>
  )
}
