import { useSetAtom } from "jotai"
import { pathsAtom } from "../state/pathsAtom"
import { fileExplorerAtom } from "../state/uiAtoms"
import type { PathVar } from "../types"

interface PathVarCardProps {
  pathVar: PathVar
  isFirst: boolean
}

export const PathVarCard = ({ pathVar, isFirst }: PathVarCardProps) => {
  const setPaths = useSetAtom(pathsAtom)
  const setFileExplorer = useSetAtom(fileExplorerAtom)

  const setLabel = (label: string) => {
    setPaths((paths) => paths.map((path) => (path.id === pathVar.id ? { ...path, label } : path)))
  }

  const setValue = (value: string) => {
    setPaths((paths) => paths.map((path) => (path.id === pathVar.id ? { ...path, value } : path)))
  }

  const removePath = () => {
    setPaths((paths) => paths.filter((path) => path.id !== pathVar.id))
  }

  const handleBrowse = async () => {
    if (pathVar.value) {
      setFileExplorer({ path: pathVar.value, pickerOnSelect: null })
    } else {
      let startPath = "/"
      try {
        const response = await fetch("/files/default-path")
        const data = (await response.json()) as { path?: string }
        startPath = data.path ?? "/"
      } catch {
        // fall back to "/"
      }
      setFileExplorer({
        path: startPath,
        pickerOnSelect: (selectedPath) => {
          setValue(selectedPath)
        },
      })
    }
  }

  return (
    <div
      data-path-var={pathVar.id}
      className="col-span-full bg-slate-800/40 rounded-xl border border-dashed border-slate-600 px-4 py-3"
    >
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={handleBrowse}
          title={
            pathVar.value
              ? "Browse files in this folder"
              : "Browse to pick a folder for this path variable"
          }
          aria-label={
            pathVar.value ? "Browse files in this folder" : "Pick a folder for this path variable"
          }
          className="text-xs text-slate-500 hover:text-slate-300 w-5 h-5 flex items-center justify-center rounded hover:bg-slate-700 shrink-0"
        >
          📁
        </button>
        <input
          type="text"
          defaultValue={pathVar.label}
          data-action="set-path-label"
          data-pv-id={pathVar.id}
          onChange={(event) => setLabel(event.currentTarget.value)}
          className="text-xs font-medium text-slate-300 bg-transparent border-b border-slate-600 focus:outline-none focus:border-blue-500 flex-1 min-w-0"
        />
        <span className="text-xs text-slate-600 font-mono shrink-0">path variable</span>
        {!isFirst && (
          <button
            type="button"
            onClick={removePath}
            title="Remove path variable"
            aria-label="Remove path variable"
            className="text-xs text-slate-500 hover:text-red-400 w-5 h-5 flex items-center justify-center rounded hover:bg-slate-700"
          >
            ✕
          </button>
        )}
      </div>
      <input
        type="text"
        defaultValue={pathVar.value}
        placeholder="/mnt/media or D:\Media"
        data-action="set-path-value"
        data-pv-id={pathVar.id}
        onBlur={(event) => setValue(event.currentTarget.value)}
        className="w-full bg-slate-900 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"
      />
    </div>
  )
}
