interface DoubleChevronProps {
  isCollapsed: boolean
}

export const DoubleChevron = ({ isCollapsed }: DoubleChevronProps) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`w-3.5 h-3.5 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
  >
    <polyline points="5,5 10,10 15,5" />
    <polyline points="5,11 10,16 15,11" />
  </svg>
)
