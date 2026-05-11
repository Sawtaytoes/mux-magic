import { useAtomValue } from "jotai"

import { isFieldVisible } from "../../commands/fieldVisibility"
import { commandsAtom } from "../../state/commandsAtom"
import type { CommandField, Step } from "../../types"
import { FieldLabel } from "../FieldLabel/FieldLabel"

// ─── TodoField ────────────────────────────────────────────────────────────────
// Temporary placeholder rendered until W2A–W2D replace each case in the
// dispatcher switch below. W2A–W2D: use Edit tool on the matching case block.

type TodoFieldProps = {
  type: string
  field: CommandField
  step: Step
}

const TodoField = ({ type, field }: TodoFieldProps) => (
  <div
    className="text-xs text-amber-400 italic py-0.5"
    data-todo-field-type={type}
  >
    [TodoField: {type} — {field.name}]
  </div>
)

// ─── Field dispatcher ─────────────────────────────────────────────────────────

type FieldDispatcherProps = {
  field: CommandField
  step: Step
}

const FieldDispatcher = ({
  field,
  step,
}: FieldDispatcherProps) => {
  if (field.type === "hidden") return null

  switch (field.type) {
    case "boolean":
      return (
        <TodoField
          type="boolean"
          field={field}
          step={step}
        />
      )
    case "path":
      return (
        <TodoField type="path" field={field} step={step} />
      )
    case "number":
      return (
        <TodoField
          type="number"
          field={field}
          step={step}
        />
      )
    case "enum":
      return (
        <TodoField type="enum" field={field} step={step} />
      )
    case "numberWithLookup":
      return (
        <TodoField
          type="numberWithLookup"
          field={field}
          step={step}
        />
      )
    case "languageCode":
      return (
        <TodoField
          type="languageCode"
          field={field}
          step={step}
        />
      )
    case "languageCodes":
      return (
        <TodoField
          type="languageCodes"
          field={field}
          step={step}
        />
      )
    case "stringArray":
      return (
        <TodoField
          type="stringArray"
          field={field}
          step={step}
        />
      )
    case "numberArray":
      return (
        <TodoField
          type="numberArray"
          field={field}
          step={step}
        />
      )
    case "json":
      return (
        <TodoField type="json" field={field} step={step} />
      )
    case "folderMultiSelect":
      return (
        <TodoField
          type="folderMultiSelect"
          field={field}
          step={step}
        />
      )
    case "subtitleRules":
      return (
        <TodoField
          type="subtitleRules"
          field={field}
          step={step}
        />
      )
    default:
      return (
        <TodoField
          type={`string(${field.type})`}
          field={field}
          step={step}
        />
      )
  }
}

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
    (field) => {
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
                (fieldDef) =>
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
                <FieldLabel
                  command={step.command}
                  field={groupField}
                />
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
          <FieldLabel
            command={step.command}
            field={field}
          />
          <FieldDispatcher field={field} step={step} />
        </div>,
      ]
    },
  )

  return <div className="space-y-1">{fieldElements}</div>
}
