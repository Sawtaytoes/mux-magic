import { Tooltip } from "@charcuterie/ui"

import type { CommandField } from "../../commands/types"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import type { Step } from "../../types"

type BooleanFieldProps = {
  field: CommandField
  step: Step
}

/**
 * The one field that is deliberately **not** a `CommandFieldControl`.
 *
 * `Field` renders `label` above `control` in a `flex-col`, which is right
 * for a text input and wrong for a checkbox — a checkbox reads left of its
 * text, and stacking every boolean in a step card (`isRecursive`,
 * `isSourceDeleted`, `isDryRun`, …) doubles the card's height for no gain.
 * A wrapping `<label>` is also the one association that needs no `for` at
 * all, so there is no dangling-id bug here to fix.
 *
 * What WAS broken: `FieldLabel` is itself a `<label>`, and it was rendered
 * **inside** this one. `<label>` forbids descendant `<label>` elements
 * outright, and the inner one carried a `for` pointing at the same input
 * the outer one already wraps — two associations for one control, one of
 * them invalid markup. Neither typecheck, lint, nor axe reports it.
 */
export const BooleanField = ({
  field,
  step,
}: BooleanFieldProps) => {
  const { setParam } = useBuilderActions()
  const checked =
    step.params[field.name] ?? field.default ?? false

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setParam(step.id, field.name, event.target.checked)
  }

  const checkbox = (
    <input
      checked={Boolean(checked)}
      className="w-3.5 h-3.5 rounded bg-slate-700 border-slate-500 accent-blue-500 cursor-pointer"
      onChange={handleChange}
      required={field.isRequired ?? undefined}
      type="checkbox"
    />
  )

  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is the `<input type="checkbox">` below — wrapped, which is the association that needs no `for` at all. The rule cannot see it because `Tooltip` clones the input rather than rendering it as a literal child.
    <label className="flex items-center gap-2 cursor-pointer select-none py-0.5 text-content-secondary text-xs">
      {field.description ? (
        <Tooltip label={field.description}>
          {checkbox}
        </Tooltip>
      ) : (
        checkbox
      )}

      <span>
        {field.label ?? field.name}

        {field.isRequired ? (
          <span
            aria-hidden="true"
            className="ms-1 text-intent-danger-content"
          >
            *
          </span>
        ) : null}
      </span>
    </label>
  )
}
