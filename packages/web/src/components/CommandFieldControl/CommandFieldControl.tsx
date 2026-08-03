import { Field } from "@charcuterie/ui"
import type { ReactElement } from "react"

import type { CommandField } from "../../commands/types"
import { DescribedControl } from "./DescribedControl"

type CommandFieldControlProps = {
  /**
   * The one control this field is. A field whose control is several
   * elements — two inputs, a list of rule rows, a chip list plus a button —
   * is a `CommandFieldGroup` instead, because a `<label for>` can only point
   * at one thing.
   */
  children: ReactElement
  className?: string
  field: Pick<
    CommandField,
    "description" | "isRequired" | "label" | "name"
  >
}

/**
 * Replaces `FieldLabel` at every call site that has a single control.
 *
 * `FieldLabel` rendered `<label htmlFor={`${stepId}-${field.name}`}>` and
 * left it to each of its sixteen callers to render an element with that id.
 * **Eight of them did not** — `RegexWithFlagsField`, `FolderTagsField`,
 * `SubtitleRulesField`, `LanguageCodesField`, `SubtitleTypesField`,
 * `LanguageCodeField`, `FolderMultiSelectField` and `RenameRegexField` all
 * pointed at an id nothing in the document had. A dangling `for` is not a
 * degraded label, it is no label: the control is announced as an unnamed
 * textbox and the label text is announced as loose prose. Nothing could see
 * it — the attribute is present and correctly spelled, and there is no
 * axe rule for a `for` that resolves to nothing on a control that has no
 * other name.
 *
 * `Field` closes it by construction: the id comes from one `useUniqueId` and
 * is cloned onto the control, so the label and the control cannot disagree.
 * That also means the id is no longer `${step.id}-${field.name}` — see
 * `docs/decisions/2026-07-31-field-owns-the-control-id.md`.
 */
export const CommandFieldControl = ({
  children,
  className,
  field,
}: CommandFieldControlProps) => (
  <Field
    className={className}
    isRequired={field.isRequired ?? false}
    label={field.label ?? field.name}
  >
    <DescribedControl description={field.description}>
      {children}
    </DescribedControl>
  </Field>
)
