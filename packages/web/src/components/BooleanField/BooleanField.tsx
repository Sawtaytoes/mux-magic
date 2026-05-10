import type { CommandField, Step } from "../../types"

type BooleanFieldProps = {
  step: Step
  field: CommandField
}

export const BooleanField = ({
  step,
  field,
}: BooleanFieldProps) => {
  const checked = Boolean(
    step.params[field.name] ?? field.default ?? false,
  )
  const tooltipKey = `${step.command}:${field.name}`

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    window.setParamAndRender?.(
      step.id,
      field.name,
      event.target.checked,
    )
  }

  return (
    <label
      className="flex items-center gap-2 cursor-pointer select-none py-0.5"
      data-tooltip-key={tooltipKey}
    >
      <input
        type="checkbox"
        defaultChecked={checked}
        onChange={handleChange}
        className="w-3.5 h-3.5 rounded bg-slate-700 border-slate-500 accent-blue-500 cursor-pointer"
      />
      <span className="text-xs text-slate-300">
        {field.label ?? field.name}
      </span>
    </label>
  )
}
