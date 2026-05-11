interface SwitchProps {
  isOn: boolean
  activeTrackClass: string
}

export const Switch = ({ isOn, activeTrackClass }: SwitchProps) => (
  <span
    className={`relative shrink-0 inline-flex w-8 h-4 rounded-full overflow-hidden border transition-colors ${
      isOn ? activeTrackClass : "bg-slate-600 border-slate-500"
    }`}
    aria-hidden="true"
  >
    <span
      className="absolute top-px left-px w-3 h-3 rounded-full bg-white shadow-sm"
      style={{
        transition: "transform 150ms ease",
        transform: isOn ? "translateX(1rem)" : undefined,
      }}
    />
  </span>
)
