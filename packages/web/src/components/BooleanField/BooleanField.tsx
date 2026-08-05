import { Checkbox, Tooltip } from "@charcuterie/ui"

import type { CommandField } from "../../commands/types"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import type { Step } from "../../types"

type BooleanFieldProps = {
  field: CommandField
  step: Step
}

/**
 * A boolean step param, rendered with Charcuterie's `Checkbox`.
 *
 * Was a hand-rolled `<input type="checkbox">` in
 * `bg-slate-700 border-slate-500 accent-blue-500` — palette colours
 * with no light mode, written before the library had a checkbox to
 * reach for. `Checkbox` now owns the box, the wrapping `<label>` (the
 * one association that needs no `for`, so there was never a
 * dangling-id bug here to fix), and the tokens that read in every
 * scheme; this file is just the bind to the step store.
 *
 * Uncontrolled-with-initial, the same contract `StringField` already
 * uses with `defaultValue`: `isChecked` seeds the box from the param,
 * `onChange` writes each toggle back. The store is written and the box
 * owns its own state — consistent with every other field in the card,
 * and the reason `Checkbox` takes no controlled `checked`.
 */
export const BooleanField = ({
  field,
  step,
}: BooleanFieldProps) => {
  const { setParam } = useBuilderActions()

  const isChecked = Boolean(
    step.params[field.name] ?? field.default ?? false,
  )

  const checkbox = (
    <Checkbox
      isChecked={isChecked}
      label={
        <>
          {field.label ?? field.name}

          {field.isRequired ? (
            <span
              aria-hidden="true"
              className="ms-1 text-intent-danger-content"
            >
              *
            </span>
          ) : null}
        </>
      }
      onChange={(isNowChecked) => {
        setParam(step.id, field.name, isNowChecked)
      }}
      size="sm"
    />
  )

  // The description rides a `Tooltip` over the whole control, as it
  // did before — `Checkbox` owns the input now, so the tip anchors to
  // a wrapping span rather than the raw box.
  return field.description ? (
    <Tooltip label={field.description}>
      <span className="inline-flex">{checkbox}</span>
    </Tooltip>
  ) : (
    checkbox
  )
}
