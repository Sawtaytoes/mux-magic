import { Combobox } from "@charcuterie/ui"
import type { Variable } from "../../types"
import { usePathAutocomplete } from "../PathPicker/usePathAutocomplete"

export const PathValueInput = ({
  variable,
  valueInputRef,
  onValueChange,
}: {
  variable: Variable
  valueInputRef: React.RefObject<HTMLInputElement | null>
  onValueChange: (value: string) => void
}) => {
  const pathAutocomplete = usePathAutocomplete({
    onWriteValue: onValueChange,
    value: variable.value,
  })

  return (
    <>
      <input
        ref={valueInputRef}
        type="text"
        value={variable.value}
        placeholder="/mnt/media or D:\Media"
        data-action="set-path-value"
        data-pv-id={variable.id}
        onChange={(event) =>
          pathAutocomplete.onInputChange(
            event.currentTarget.value,
          )
        }
        className="w-full bg-slate-900 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"
      />

      {/* Directory autocomplete attached to the input above. */}
      <Combobox
        emptyLabel="No matching entries."
        error={pathAutocomplete.error}
        inputRef={valueInputRef}
        isLoading={pathAutocomplete.isLoading}
        isVisible={pathAutocomplete.isOpen}
        onDismiss={pathAutocomplete.close}
        onSelect={pathAutocomplete.onSelectFolder}
        options={pathAutocomplete.options}
        query={variable.value}
      />
    </>
  )
}
