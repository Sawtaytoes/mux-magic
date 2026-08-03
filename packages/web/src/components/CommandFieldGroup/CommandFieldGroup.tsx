import { Tooltip } from "@charcuterie/ui"
import type { ReactNode } from "react"
import { useId } from "react"

import type { CommandField } from "../../commands/types"

type CommandFieldGroupProps = {
  children: ReactNode
  className?: string
  field: Pick<
    CommandField,
    "description" | "isRequired" | "label" | "name"
  >
  /**
   * Rendered on the label row, to the right — the display-mode toggles and
   * "Add rule" buttons these fields already carry beside their heading.
   */
  actions?: ReactNode
}

/**
 * The group half of the `FieldLabel` replacement, for the five command
 * fields whose control is **not one element**: `RegexWithFlagsField`
 * (pattern + flags), `SubtitleRulesField` (rule rows), `RenameRegexField`
 * (rule rows), `FolderMultiSelectField` (chips + a browse button) and
 * `PathField` (an input plus two picker buttons).
 *
 * `Field` is the wrong shape for these and would be worse than what it
 * replaced: it renders a real `<label htmlFor>`, so pointing it at a
 * multi-control field means either a `for` that resolves to nothing — which
 * is exactly the bug being fixed — or a label attached to whichever one
 * control was picked, silently claiming to name the other three. This is
 * a gap in `@charcuterie/ui`: `Field` has no group mode, and a field with
 * several controls is a real shape the fleet has five of.
 *
 * So the label is a `<span>` and the controls are a `role="group"` that
 * points at it. `<fieldset>` / `<legend>` is the semantic element for this
 * and was rejected for the reason `AccordionSection` gives: it drags form
 * reset behaviour and `<legend>`'s own layout rules onto something that is
 * one row of a step card.
 *
 * ### The description gets a real trigger here, and can
 *
 * `CommandFieldControl` puts the tooltip on the control itself, because
 * `Field` renders a `<label>` and a `<label>` may not contain a labelable
 * element — a `<button>` inside one is invalid HTML **and** activates the
 * labelled control when clicked. There is no `<label>` element here, so the
 * help affordance can be what it should be: a focusable button, which is
 * what makes the tip keyboard-reachable and Escape-dismissible.
 */
export const CommandFieldGroup = ({
  actions,
  children,
  className,
  field,
}: CommandFieldGroupProps) => {
  const baseId = useId()

  const labelId = `${baseId}-label`

  const labelText = field.label ?? field.name

  return (
    <div
      className={`flex flex-col gap-1.5 ${className ?? ""}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex items-baseline gap-1 font-medium text-content-primary text-sm">
          <span id={labelId}>
            {labelText}

            {field.isRequired ? (
              <span
                // Decoration beside a real `aria-required` on the controls
                // inside. An asterisk announced as "asterisk" is noise.
                aria-hidden="true"
                className="ms-1 text-intent-danger-content"
              >
                *
              </span>
            ) : null}
          </span>

          {field.description ? (
            <Tooltip label={field.description}>
              <button
                aria-label={`About ${labelText}`}
                className="cursor-help rounded-full border border-border-default px-1 text-content-secondary text-xs leading-none hover:text-content-primary"
                type="button"
              >
                ?
              </button>
            </Tooltip>
          ) : null}
        </span>

        {actions}
      </div>

      {/* biome-ignore lint/a11y/useSemanticElements: the semantic element for `group` is `<fieldset>`, which drags `<legend>` layout and form-reset behaviour onto one row of a step card. */}
      <div aria-labelledby={labelId} role="group">
        {children}
      </div>
    </div>
  )
}
