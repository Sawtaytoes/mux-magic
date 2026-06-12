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

  const handleChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const newValue = event.target.value
    onIetfChange(newValue === "" ? null : newValue)
  }

  return (
    <div className="mt-1">
      <label className="block text-xs text-slate-400 mb-0.5">
        Variant
        <select
          value={selectedIetf ?? ""}
          onChange={handleChange}
          className="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 mt-0.5"
        >
          <option value="">(none)</option>
          {variants.map((variant) => (
            <option key={variant.tag} value={variant.tag}>
              {variant.name} ({variant.tag})
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
