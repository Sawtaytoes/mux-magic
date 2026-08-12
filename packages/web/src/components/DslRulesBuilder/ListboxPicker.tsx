import { useVisibility } from "@charcuterie/logic"
import { Button, Listbox } from "@charcuterie/ui"

/**
 * A one-of-several picker, as a `Listbox` rather than a native `Select`
 * — [the 2026-08-10 Charcuterie decision](https://github.com/Sawtaytoes/charcuterie/blob/master/docs/decisions/2026-08-10-listbox-and-combobox-are-the-default-and-select-is-demoted.md)
 * demoting `Select` to a stated-reason exception.
 *
 * It is a component rather than inline JSX because `Listbox` needs a
 * visibility state and these render inside a `.map` over tree nodes,
 * where a hook cannot be called.
 *
 * The accessible name carries the current value (`"Slot: matches"`)
 * because the trigger's visible text *is* that value, and WCAG 2.5.3
 * wants the visible text contained in the accessible name. It also makes
 * each row's control findable when a group has several.
 */
export const ListboxPicker = ({
  isDisabled = false,
  label,
  onChange,
  options,
  value,
}: {
  isDisabled?: boolean
  label: string
  onChange: (value: string) => void
  options: readonly { label: string; value: string }[]
  value: string
}) => {
  const { hide, isVisible, toggle } = useVisibility()

  const currentLabel =
    options.find((option) => option.value === value)
      ?.label ?? ""

  return (
    <Listbox
      isVisible={isVisible && !isDisabled}
      onDismiss={hide}
      onSelect={onChange}
      options={options}
      selectedValue={value}
      trigger={
        <Button
          appearance="outline"
          aria-label={`${label}: ${currentLabel}`}
          intent="neutral"
          isDisabled={isDisabled}
          onClick={toggle}
          size="sm"
        >
          {currentLabel}
        </Button>
      }
    />
  )
}
