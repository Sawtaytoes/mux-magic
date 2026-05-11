import { useAtomValue } from "jotai"

import { isFieldVisible } from "../../commands/fieldVisibility"
import { commandsAtom } from "../../state/commandsAtom"
import type { CommandField, Step } from "../../types"
import { FieldDispatcher } from "./FieldDispatcher"

// ─── RenderFields ─────────────────────────────────────────────────────────────

type RenderFieldsProps = {
  step: Step
  stepIndex: number
}

export const RenderFields = ({
  step,
  stepIndex: _stepIndex,
}: RenderFieldsProps) => {
  const commands = useAtomValue(commandsAtom)
  const commandDefinition = commands[step.command]

  if (!commandDefinition) {
    return (
      <div className="text-xs text-slate-500 italic py-1">
        {step.command
          ? `[unknown command: ${step.command}]`
          : null}
      </div>
    )
  }

  // Build group index: firstFieldName → group definition
  const groupsByFirstField = new Map<
    string,
    { fields: ReadonlyArray<string>; layout: string }
  >()
  const groupedFieldNames = new Set<string>()

  commandDefinition.groups?.forEach((group) => {
    if (group.fields.length > 0) {
      group.fields.forEach((fieldName) => {
        groupedFieldNames.add(fieldName)
      })
      groupsByFirstField.set(group.fields[0], group)
    }
  })

  const renderedGroupKeys = new Set<string>()

  // Walk fields in definition order, mirroring the legacy renderFields logic.
  const fieldElements = commandDefinition.fields.flatMap(
    (field: CommandField) => {
      if (
        field.visibleWhen &&
        !isFieldVisible(field.visibleWhen, step.params)
      ) {
        return []
      }

      const group = groupsByFirstField.get(field.name)
      if (group && !renderedGroupKeys.has(field.name)) {
        renderedGroupKeys.add(field.name)
        const groupFields = group.fields.flatMap(
          (groupFieldName) => {
            const groupField =
              commandDefinition.fields.find(
                (fieldDef: CommandField) =>
                  fieldDef.name === groupFieldName,
              )
            if (!groupField) return []
            if (
              groupField.visibleWhen &&
              !isFieldVisible(
                groupField.visibleWhen,
                step.params,
              )
            ) {
              return []
            }
            if (groupField.type === "hidden") return []
            return [
              <div
                key={groupField.name}
                className="flex flex-col"
              >
                <FieldDispatcher
                  field={groupField}
                  step={step}
                />
              </div>,
            ]
          },
        )
        if (groupFields.length === 0) return []
        return [
          <div
            key={`group-${field.name}`}
            className={group.layout}
          >
            {groupFields}
          </div>,
        ]
      }

      if (groupedFieldNames.has(field.name)) return []
      if (field.type === "hidden") return []

      return [
        <div key={field.name} className="mb-2">
          <FieldDispatcher field={field} step={step} />
        </div>,
      ]
    },
  )

  return <div className="space-y-1">{fieldElements}</div>
}
