interface CollapseChevronProps {
  isCollapsed: boolean
}

export const CollapseChevron = ({
  isCollapsed,
}: CollapseChevronProps) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`w-3.5 h-3.5 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
  >
    <polyline points="5,8 10,13 15,8" />
  </svg>
)
