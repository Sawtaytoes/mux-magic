import { useState } from "react"
import type { CommandField } from "../../commands/types"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import type { Step } from "../../types"
import { FieldLabel } from "../FieldLabel/FieldLabel"
import { TagInputBase } from "../TagInputBase/TagInputBase"

type FolderTagsFieldProps = {
  step: Step
  field: CommandField
}

export const FolderTagsField = ({
  step,
  field,
}: FolderTagsFieldProps) => {
  const { setParam } = useBuilderActions()
  const [inputValue, setInputValue] = useState("")

  const folders = Array.isArray(step.params[field.name])
    ? (step.params[field.name] as string[])
    : []

  const removeFolder = (folderToRemove: string) => {
    const updated = folders.filter(
      (folder) => folder !== folderToRemove,
    )
    setParam(
      step.id,
      field.name,
      updated.length > 0 ? updated : undefined,
    )
  }

  const addFolder = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed || folders.includes(trimmed)) return
    setParam(step.id, field.name, [...folders, trimmed])
    setInputValue("")
  }

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Enter") {
      event.preventDefault()
      addFolder(inputValue)
    }
  }

  const tags = folders.map((folder) => ({
    key: folder,
    label: <span>{folder}</span>,
    title: `Remove ${folder}`,
  }))

  return (
    <div>
      <FieldLabel command={step.command} field={field} />
      <TagInputBase
        tags={tags}
        onRemove={removeFolder}
        inputProps={{
          value: inputValue,
          placeholder: "Folder name, then Enter…",
          onChange: (event) =>
            setInputValue(event.target.value),
          onKeyDown: handleKeyDown,
        }}
      />
    </div>
  )
}
