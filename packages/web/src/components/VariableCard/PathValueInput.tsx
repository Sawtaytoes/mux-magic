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
        className="w-full bg-surface-raised text-content-primary text-xs rounded px-2 py-1.5 border border-border-default focus:outline-none focus:border-border-focus font-mono"
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
