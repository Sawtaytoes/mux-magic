import { COMMANDS } from "../commands.js"
import { isFieldVisible } from "../util/field-visibility.js"
import { renderBooleanField } from "./boolean-field.js"
import { renderEnumField } from "./enum-field.js"
import { renderFolderMultiSelectField } from "./folder-multi-select-field.js"
import { renderJsonField } from "./json-field.js"
import { renderLanguageCodeField } from "./language-code-field.js"
import { renderLanguageCodesField } from "./language-codes-field.js"
import { renderNumberArrayField } from "./number-array-field.js"
import { renderNumberField } from "./number-field.js"
import { renderNumberWithLookupField } from "./number-with-lookup-field.js"
import { renderPathField } from "./path-field.js"
import { renderStringArrayField } from "./string-array-field.js"
import { renderStringField } from "./string-field.js"
import { renderSubtitleRulesField } from "./subtitle-rules-field.js"

/**
 * @param {{ step: object, field: object, stepIndex: number }} props
 * @returns {string}
 */
function renderField({ step, field, stepIndex }) {
  if (field.type === "hidden") return ""
  if (field.type === "subtitleRules")
    return renderSubtitleRulesField({
      step,
      field,
      stepIndex,
    })
  if (field.type === "boolean")
    return renderBooleanField({ step, field })
  if (field.type === "path")
    return renderPathField({ step, field })
  if (field.type === "number")
    return renderNumberField({ step, field })
  if (field.type === "enum")
    return renderEnumField({ step, field })
  if (field.type === "numberWithLookup")
    return renderNumberWithLookupField({ step, field })
  if (field.type === "languageCode")
    return renderLanguageCodeField({ step, field })
  if (field.type === "languageCodes")
    return renderLanguageCodesField({ step, field })
  if (field.type === "stringArray")
    return renderStringArrayField({ step, field })
  if (field.type === "numberArray")
    return renderNumberArrayField({ step, field })
  if (field.type === "json")
    return renderJsonField({ step, field, stepIndex })
  if (field.type === "folderMultiSelect")
    return renderFolderMultiSelectField({ step, field })
  return renderStringField({ step, field })
}

/**
 * @param {{ step: object, stepIndex: number }} props
 * @returns {string}
 */
export function renderFields({ step, stepIndex }) {
  const cmd = COMMANDS[step.command]
  const fieldsHtml = []
  const groupedFieldNames = new Set()
  const groupsByFirstField = new Map()

  if (cmd.groups && Array.isArray(cmd.groups)) {
    cmd.groups.forEach((group) => {
      if (
        Array.isArray(group.fields) &&
        group.fields.length > 0
      ) {
        group.fields.forEach((name) =>
          groupedFieldNames.add(name),
        )
        groupsByFirstField.set(group.fields[0], group)
      }
    })
  }

  const renderedGroups = new Set()

  cmd.fields.forEach((field) => {
    if (
      field.visibleWhen &&
      !isFieldVisible(field.visibleWhen, step.params)
    )
      return

    const group = groupsByFirstField.get(field.name)
    if (group && !renderedGroups.has(group)) {
      renderedGroups.add(group)
      const groupFieldsHtml = group.fields
        .map((fieldName) => {
          const f = cmd.fields.find(
            (fld) => fld.name === fieldName,
          )
          if (!f) return ""
          if (
            f.visibleWhen &&
            !isFieldVisible(f.visibleWhen, step.params)
          )
            return ""
          return renderField({ step, field: f, stepIndex })
        })
        .filter(Boolean)
        .join("")
      if (groupFieldsHtml) {
        fieldsHtml.push(
          `<div class="${group.layout}">${groupFieldsHtml}</div>`,
        )
      }
    } else if (!groupedFieldNames.has(field.name)) {
      const fieldHtml = renderField({
        step,
        field,
        stepIndex,
      })
      if (fieldHtml) fieldsHtml.push(fieldHtml)
    }
  })

  return fieldsHtml.join("")
}
