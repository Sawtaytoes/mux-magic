import { Button, Menu } from "@charcuterie/ui"
import { useAtomValue, useSetAtom } from "jotai"
import { useState } from "react"

import {
  addVariableAtom,
  variablesAtom,
} from "../../state/variablesAtom"
import type { VariableType } from "../../types"
import { VariableCard } from "../VariableCard/VariableCard"
import { useVariableTypeMenuItems } from "./TypePicker"

export const VariablesPanel = () => {
  const variables = useAtomValue(variablesAtom)
  const addVariable = useSetAtom(addVariableAtom)
  const [isPickerOpen, setIsPickerOpen] = useState(false)

  const handlePick = (type: VariableType) => {
    addVariable({ type })
    setIsPickerOpen(false)
  }

  const typeMenuItems = useVariableTypeMenuItems({
    onPick: handlePick,
  })

  return (
    <div className="flex flex-col gap-3">
      {variables.length === 0 && (
        <p className="text-xs text-content-muted italic">
          No variables defined yet.
        </p>
      )}

      {variables.map((variable, index) => (
        <VariableCard
          key={variable.id}
          variable={variable}
          isFirst={index === 0}
        />
      ))}

      {/*
        The menu is named by its trigger — `useRole(role: "menu")` puts
        `aria-labelledby` on the panel pointing at this button, and that
        beats an `aria-label`. So the old panel's "Choose a variable type:"
        heading is gone rather than moved: it was a paragraph nothing
        referenced, and the button already says the same thing.

        The **Cancel** button is gone too. It was a hand-rolled stand-in for
        Escape and outside-press, neither of which the inline panel had.
      */}
      <Menu
        isVisible={isPickerOpen}
        items={typeMenuItems}
        onDismiss={() => {
          setIsPickerOpen(false)
        }}
        trigger={
          <Button
            aria-label="Add variable"
            intent="neutral"
            appearance="outline"
            size="sm"
            className="self-start border-dashed"
            onClick={() => {
              setIsPickerOpen(true)
            }}
          >
            + Add Variable
          </Button>
        }
      />
    </div>
  )
}
