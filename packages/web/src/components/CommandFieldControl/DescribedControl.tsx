import { Tooltip } from "@charcuterie/ui"
import type { ReactElement } from "react"
import { Children, cloneElement } from "react"

type DescribedControlProps = {
  children: ReactElement
  description?: string
}

/**
 * The adapter that lets `Field` and `Tooltip` describe the SAME element.
 *
 * Both are slot components: each clones props onto its one child. So they
 * cannot be nested around a control — `<Field><Tooltip><input/></Tooltip></Field>`
 * makes `Field` clone `id` / `aria-describedby` / `aria-invalid` / `required`
 * onto `Tooltip`, which has a closed prop list and drops all four. Nothing
 * errors: the field renders, the label points at nothing, and every assertion
 * about the control's own props passes because they never arrived. That is
 * the failure `Select`'s docstring warns about, arriving from the other
 * direction.
 *
 * This component is deliberately transparent — whatever it is handed, it
 * forwards to the control — so `Field` clones onto it and the props land on
 * the `<input>` that `Tooltip` also references. One element, both
 * relationships.
 *
 * The description hangs off the CONTROL rather than off the label, which is
 * the substantive change from the `FieldTooltip` this replaces:
 *
 *  - `FieldTooltip` anchored a `<span>` inside a `<label>`. A `<span>` is not
 *    focusable, so the tip was pointer-only (WCAG 2.1.1) and had no Escape
 *    (WCAG 1.4.13).
 *  - `useRole(context, { role: "tooltip" })` puts `aria-describedby` on the
 *    reference element. On a control that means the description is announced
 *    with the thing it describes; on a `<span>` inside a label it meant
 *    nothing referenced the tip at all.
 */
export const DescribedControl = ({
  children,
  description,
  ...slotProps
}: DescribedControlProps) => {
  const control = cloneElement(
    Children.only(children),
    slotProps,
  )

  if (!description) {
    return control
  }

  return <Tooltip label={description}>{control}</Tooltip>
}
