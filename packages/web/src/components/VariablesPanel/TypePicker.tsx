import type { MenuItem } from "@charcuterie/ui"
import { useAtomValue } from "jotai"

import { variablesAtom } from "../../state/variablesAtom"
import type { VariableType } from "../../types"
import { listVariableTypes } from "../VariableCard/registry"

/**
 * The items for the "Add Variable" menu.
 *
 * ### It stayed a menu, and that reverses charcuterie's own claim
 *
 * `@charcuterie/ui`'s `Menu` docstring names this component as "the fleet's
 * one attempt at telling [a menu and a listbox] apart — it renders
 * `role="menu"` over items that set a value, which is a listbox wearing the
 * wrong role."
 *
 * Measured against the distinction that docstring itself draws — a
 * `menuitem` **does** something, an `option` **is** something you are
 * choosing — this is a menu, and the old markup had the role right:
 *
 *  - Choosing "Path" **adds a path variable**. A card appears at the bottom
 *    of the panel and the picker closes.
 *  - **Nothing is selected afterwards.** There is no `aria-selected` state
 *    to report, no value the control holds, and no way to reopen it and see
 *    what was picked last time — reopening offers the same list minus
 *    whatever now exists.
 *  - Its items are **not alternatives**. Adding a Path variable and a TMDB
 *    ID variable are both possible, and adding one does not un-add the
 *    other. A listbox would have to answer "which one is selected?", and
 *    there is no answer.
 *
 * So `role="menu"` is kept. What was wrong with it was everything else: an
 * inline panel with no relationship to its trigger, no roving focus, no
 * Escape, no outside-press, and a hand-rolled **Cancel** button standing in
 * for all three. `Menu` supplies them.
 */
export const useVariableTypeMenuItems = ({
  onPick,
}: {
  onPick: (type: VariableType) => void
}): MenuItem[] => {
  const variables = useAtomValue(variablesAtom)

  const availableTypes = listVariableTypes().filter(
    (definition) => {
      if (definition.cardinality === "singleton") {
        return variables.every(
          (variable) => variable.type !== definition.type,
        )
      }

      return true
    },
  )

  if (availableTypes.length === 0) {
    return [
      {
        // A disabled item rather than an empty panel. `Menu` renders what
        // it is given, and an empty `role="menu"` is announced as "menu, 0
        // items" — which reads as a bug rather than as an answer. A
        // disabled item stays in the DOM and stays announced; it is only
        // skipped by the arrow keys.
        isDisabled: true,
        key: "none-available",
        label: "All variable types are already added.",
        onSelect: () => {},
      },
    ]
  }

  return availableTypes.map((definition) => ({
    key: definition.type,
    label: definition.label,
    onSelect: () => {
      onPick(definition.type)
    },
  }))
}
