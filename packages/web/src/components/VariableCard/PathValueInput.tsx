import { useSetAtom } from "jotai"
import { useEffect, useRef } from "react"
import { pathPickerStateAtom } from "../../state/pickerAtoms"
import type { Variable } from "../../types"
import { parentPathFromInput } from "../PathPicker/parentPathFromInput"

export const PathValueInput = ({
  variable,
  valueInputRef,
  onValueChange,
}: {
  variable: Variable
  valueInputRef: React.RefObject<HTMLInputElement | null>
  onValueChange: (value: string) => void
}) => {
  const setPathPickerState = useSetAtom(pathPickerStateAtom)
  const debounceTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null)

  useEffect(
    () => () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    },
    [],
  )

  const handleInputChange = (rawValue: string) => {
    onValueChange(rawValue)
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    const currentInput = valueInputRef.current
    if (
      currentInput &&
      /^([/\\]|[A-Za-z]:[/\\])/.test(rawValue)
    ) {
      const { parentPath, query } =
        parentPathFromInput(rawValue)
      debounceTimerRef.current = setTimeout(() => {
        const rect = currentInput.getBoundingClientRect()
        setPathPickerState({
          inputElement: currentInput,
          target: {
            mode: "pathVariable",
            pathVariableId: variable.id,
          },
          parentPath,
          query,
          triggerRect: {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
          },
          entries: null,
          error: null,
          activeIndex: 0,
          matches: null,
          separator: "/",
          cachedParentPath: null,
          requestToken: 0,
          debounceTimerId: null,
        })
      }, 250)
    } else {
      setPathPickerState(null)
    }
  }

  return (
    <input
      ref={valueInputRef}
      type="text"
      value={variable.value}
      placeholder="/mnt/media or D:\Media"
      data-action="set-path-value"
      data-pv-id={variable.id}
      onChange={(event) =>
        handleInputChange(event.currentTarget.value)
      }
      className="w-full bg-slate-900 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"
    />
  )
}
