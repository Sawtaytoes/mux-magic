type AspectLockButtonProps = {
  isLocked: boolean
  isReadOnly: boolean
  ariaLabel: string
  onToggle: (isNextLocked: boolean) => void
}

export const AspectLockButton = ({
  isLocked,
  isReadOnly,
  ariaLabel,
  onToggle,
}: AspectLockButtonProps) => (
  <button
    type="button"
    aria-label={ariaLabel}
    aria-pressed={isLocked}
    disabled={isReadOnly}
    onClick={() => {
      onToggle(!isLocked)
    }}
    className={`p-0.5 rounded ${
      isLocked
        ? "text-blue-400 hover:text-blue-300"
        : "text-slate-500 hover:text-slate-300"
    } disabled:opacity-50 disabled:cursor-not-allowed`}
  >
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`w-3.5 h-3.5 ${isLocked ? "" : "opacity-60"}`}
    >
      <path d="M11 4.5 12.5 3a3 3 0 0 1 4.5 4.5L15.5 9" />
      <path d="M9 15.5 7.5 17a3 3 0 0 1-4.5-4.5L4.5 11" />
      {isLocked ? (
        <path d="M8 11.5 11.5 8" />
      ) : (
        <>
          <path d="M14 13.5 17 16" />
          <path d="M6 6.5 3 4" />
        </>
      )}
    </svg>
  </button>
)
