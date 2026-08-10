import { Button, IconButton } from "@charcuterie/ui"
import { useSetAtom } from "jotai"
import type { CommandField } from "../../commands/types"
import { fileExplorerAtom } from "../../components/FileExplorerModal/fileExplorerAtom"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import type { Step } from "../../types"
import { CommandFieldGroup } from "../CommandFieldGroup/CommandFieldGroup"

type FolderMultiSelectFieldProps = {
  field: CommandField
  step: Step
}

export const FolderMultiSelectField = ({
  field,
  step,
}: FolderMultiSelectFieldProps) => {
  const { setParam } = useBuilderActions()
  const setFileExplorer = useSetAtom(fileExplorerAtom)

  const folders = Array.isArray(step.params[field.name])
    ? (step.params[field.name] as string[])
    : []

  const removeFolder = (folderToRemove: string) => {
    setParam(
      step.id,
      field.name,
      folders.filter((folder) => folder !== folderToRemove),
    )
  }

  const handleBrowse = () => {
    setFileExplorer({
      path: "",
      pickerOnSelect: (selectedPath) => {
        setParam(step.id, field.name, [
          ...folders,
          selectedPath,
        ])
      },
    })
  }

  return (
    <CommandFieldGroup className="mb-2" field={field}>
      <div className="flex flex-wrap gap-1 mb-1.5">
        {folders.map((folder) => (
          <span
            key={folder}
            className="inline-flex items-center gap-1 bg-surface-sunken text-content-primary text-xs rounded px-1.5 py-0.5 font-mono"
          >
            📁 {folder}
            <IconButton
              label={`Remove ${folder}`}
              title={`Remove ${folder}`}
              intent="danger"
              appearance="ghost"
              size="sm"
              onClick={() => removeFolder(folder)}
              className="leading-none"
            >
              ✕
            </IconButton>
          </span>
        ))}
      </div>
      <Button
        intent="neutral"
        appearance="soft"
        size="sm"
        onClick={handleBrowse}
      >
        📁 Browse folders…
      </Button>
    </CommandFieldGroup>
  )
}
