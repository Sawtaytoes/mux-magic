import { Picker } from "@charcuterie/ui"

/**
 * The DSL builder's one-of-several picker — [Charcuterie's
 * `Picker`](https://github.com/Sawtaytoes/charcuterie/blob/master/packages/ui/src/Picker/Picker.tsx)
 * with this app's row styling already applied.
 *
 * The open state, the `Button` trigger and the hand-rolled
 * `${label}: ${value}` accessible name used to live here; `Picker`
 * (ui@2.15.0) is that assembly done once for the fleet, and names this
 * component as one of the four it replaces. What is left is the part
 * that is genuinely mux-magic's: the builder's rows are dense, so every
 * control in them is `size="sm"`, and the trigger carries no chevron.
 * Both would otherwise be repeated at each of the eight call sites.
 *
 * `iconEnd={null}` is deliberate rather than incidental. `Picker`
 * defaults to a chevron this trigger never had, and adding one here
 * would move a Storybook baseline for a change nobody asked for. A
 * chevron for these rows is a design decision, and its own change.
 *
 * It is a component rather than inline JSX for the same reason it
 * always was: these render inside a `.map` over tree nodes, where a
 * hook cannot be called.
 *
 * `className` and `hasChevron` are both for the rows that came off a
 * native `Select`: their measured widths were on the control's outer
 * box, which is the trigger now, and the control they replace had a
 * chevron that the combinator rows never did.
 */
export const ListboxPicker = ({
  className,
  hasChevron = false,
  isDisabled = false,
  label,
  onChange,
  options,
  value,
}: {
  className?: string
  hasChevron?: boolean
  isDisabled?: boolean
  label: string
  onChange: (value: string) => void
  options: readonly { label: string; value: string }[]
  value: string
}) => (
  <Picker
    className={className}
    iconEnd={hasChevron ? undefined : null}
    isDisabled={isDisabled}
    label={label}
    onChange={onChange}
    options={options}
    size="sm"
    value={value}
  />
)
