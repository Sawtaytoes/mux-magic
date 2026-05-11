import { useSetAtom } from "jotai"

import { useBuilderActions } from "../../hooks/useBuilderActions"
import { fileExplorerAtom } from "../../state/uiAtoms"
import type { CommandField, Step } from "../../types"
import { FieldLabel } from "../FieldLabel/FieldLabel"

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
    <div className="mb-2">
      <FieldLabel command={step.command} field={field} />
      <div className="flex flex-wrap gap-1 mb-1.5">
        {folders.map((folder) => (
          <span
            key={folder}
            className="inline-flex items-center gap-1 bg-slate-700 text-slate-200 text-xs rounded px-1.5 py-0.5 font-mono"
          >
            📁 {folder}
            <button
              type="button"
              onClick={() => removeFolder(folder)}
              className="text-slate-400 hover:text-red-400 leading-none cursor-pointer"
              title={`Remove ${folder}`}
            >
              ✕
            </button>
          </span>
        ))}
      </div>
      <button
        type="button"
        onClick={handleBrowse}
        className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-1 rounded border border-slate-600 focus:outline-none focus:border-blue-500"
      >
        📁 Browse folders…
      </button>
    </div>
  )
}
