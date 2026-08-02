import { Field, Select } from "@charcuterie/ui"

import { BCP47_VARIANTS } from "../../data/bcp47Variants"

type RegionVariantFieldProps = {
  baseCode: string
  selectedIetf: string | null
  onIetfChange: (tag: string | null) => void
}

export const RegionVariantField = ({
  baseCode,
  onIetfChange,
  selectedIetf,
}: RegionVariantFieldProps) => {
  const variants = BCP47_VARIANTS.filter(
    (variant) => variant.base === baseCode,
  )

  if (variants.length === 0) {
    return null
  }

  const handleChange = (newValue: string) => {
    onIetfChange(newValue === "" ? null : newValue)
  }

  return (
    <div className="mt-1">
      <Field label="Variant">
        <Select
          onChange={handleChange}
          options={[
            { label: "(none)", value: "" },
            ...variants.map((variant) => ({
              label: `${variant.name} (${variant.tag})`,
              value: variant.tag,
            })),
          ]}
          size="sm"
          // `key` re-seeds the uncontrolled `<select>` when the BASE CODE
          // changes. `Select` owns no value — the platform does — so a new
          // `variants` list with the old DOM selection still in it would
          // keep showing a variant of the language the user just left.
          key={baseCode}
          value={selectedIetf ?? ""}
        />
      </Field>
    </div>
  )
}
