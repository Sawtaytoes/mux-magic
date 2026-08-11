import { useAtomValue } from "jotai"
import type { ReactNode } from "react"

import { isFieldVisible } from "../../commands/fieldVisibility"
import type { CommandField } from "../../commands/types"
import { commandsAtom } from "../../state/commandsAtom"
import type { Step } from "../../types"
import { FieldDispatcher } from "./FieldDispatcher"

// ─── RenderFields ─────────────────────────────────────────────────────────────

// The subtitle-extraction fields that sit two-up (side by side) in a wide
// step body and stack on narrow. Only a *consecutive* run of two or more of
// these gets the two-column grid; a lone one (e.g. `subtitlesLanguages` on
// keepLanguages) falls back to normal single-field rendering.
const TWO_COL_FIELDS = new Set<string>([
  "subtitlesLanguages",
  "typesMode",
  "subtitleTypes",
])

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
      <div className="text-xs text-content-muted italic py-1">
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
  // A consecutive run of the subtitle two-column fields is buffered and, when
  // two or more accumulate, emitted inside a single `.field-group-two-col`
  // grid; anything else flushes the buffer first (a run of one falls back to
  // a normal single-field render).
  const fieldElements: ReactNode[] = []
  let pendingTwoCol: Array<{
    name: string
    node: ReactNode
  }> = []

  const flushTwoCol = () => {
    if (pendingTwoCol.length === 0) return
    if (pendingTwoCol.length === 1) {
      fieldElements.push(pendingTwoCol[0].node)
    } else {
      fieldElements.push(
        <div
          key={`two-col-${pendingTwoCol[0].name}`}
          className="field-group-two-col"
        >
          {pendingTwoCol.map((entry) => entry.node)}
        </div>,
      )
    }
    pendingTwoCol = []
  }

  for (const field of commandDefinition.fields as ReadonlyArray<CommandField>) {
    if (
      field.visibleWhen &&
      !isFieldVisible(field.visibleWhen, step.params)
    ) {
      continue
    }

    const group = groupsByFirstField.get(field.name)
    if (group && !renderedGroupKeys.has(field.name)) {
      renderedGroupKeys.add(field.name)
      const groupFields = group.fields.flatMap(
        (groupFieldName) => {
          const groupField = commandDefinition.fields.find(
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
      if (groupFields.length === 0) continue
      flushTwoCol()
      fieldElements.push(
        <div
          key={`group-${field.name}`}
          className={group.layout}
        >
          {groupFields}
        </div>,
      )
      continue
    }

    if (groupedFieldNames.has(field.name)) continue
    if (field.type === "hidden") continue

    const fieldNode = (
      <div key={field.name}>
        <FieldDispatcher field={field} step={step} />
      </div>
    )

    if (TWO_COL_FIELDS.has(field.name)) {
      pendingTwoCol.push({
        name: field.name,
        node: fieldNode,
      })
    } else {
      flushTwoCol()
      fieldElements.push(fieldNode)
    }
  }

  flushTwoCol()

  return <div className="space-y-2">{fieldElements}</div>
}
