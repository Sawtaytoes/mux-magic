import type { CommandField } from "../../commands/types"
import type { Step } from "../../types"
import { BooleanField } from "../BooleanField/BooleanField"
import { EnumField } from "../EnumField/EnumField"
import { FolderMultiSelectField } from "../FolderMultiSelectField/FolderMultiSelectField"
import { FolderTagsField } from "../FolderTagsField/FolderTagsField"
import { JsonField } from "../JsonField/JsonField"
import { LanguageCodeField } from "../LanguageCodeField/LanguageCodeField"
import { LanguageCodesField } from "../LanguageCodesField/LanguageCodesField"
import { NumberArrayField } from "../NumberArrayField/NumberArrayField"
import { NumberField } from "../NumberField/NumberField"
import { NumberWithLookupField } from "../NumberWithLookupField/NumberWithLookupField"
import { PathField } from "../PathField/PathField"
import { RegexWithFlagsField } from "../RegexWithFlagsField/RegexWithFlagsField"
import { RenameRegexField } from "../RenameRegexField/RenameRegexField"
import { StringArrayField } from "../StringArrayField/StringArrayField"
import { StringField } from "../StringField/StringField"
import { SubtitleRulesField } from "../SubtitleRulesField/SubtitleRulesField"
import { TodoField } from "./TodoField"

type FieldDispatcherProps = {
  field: CommandField
  step: Step
}

export const FieldDispatcher = ({
  field,
  step,
}: FieldDispatcherProps) => {
  if (field.type === "hidden") return null

  switch (field.type) {
    case "boolean":
      return <BooleanField field={field} step={step} />
    case "path":
      return <PathField field={field} step={step} />
    case "number":
      return <NumberField field={field} step={step} />
    case "enum":
      return <EnumField field={field} step={step} />
    case "numberWithLookup":
      return (
        <NumberWithLookupField field={field} step={step} />
      )
    case "languageCode":
      return <LanguageCodeField field={field} step={step} />
    case "languageCodes":
      return (
        <LanguageCodesField field={field} step={step} />
      )
    case "stringArray":
      return <StringArrayField field={field} step={step} />
    case "numberArray":
      return <NumberArrayField field={field} step={step} />
    case "json":
      return (
        <JsonField
          field={field}
          step={step}
          isReadOnly={false}
        />
      )
    case "folderMultiSelect":
      return (
        <FolderMultiSelectField field={field} step={step} />
      )
    case "folderTags":
      return <FolderTagsField field={field} step={step} />
    case "string":
      return <StringField field={field} step={step} />
    case "subtitleRules":
      return (
        <SubtitleRulesField field={field} step={step} />
      )
    case "renameRegex":
      return <RenameRegexField field={field} step={step} />
    case "regexWithFlags":
      return (
        <RegexWithFlagsField field={field} step={step} />
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
