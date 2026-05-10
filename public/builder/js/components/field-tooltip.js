// Hover tooltips for the per-field labels rendered by step-renderer.
//
// One shared popover element (#field-tooltip-popover) is repositioned
// next to whichever label the cursor entered. Content comes from
// window.commandDescriptions (auto-generated from Zod schemas at
// prebuild). Labels opt in by carrying:
//
//   data-tooltip-key="<commandName>:<fieldName>"
//
// Adding the dataset attribute is cheap on the renderer side; the
// listener is attached once per page load via event delegation, so
// re-renders don't need to re-bind anything.
//
// Why a custom popover instead of the native title attribute?
//   - Title shows after a long browser-controlled delay and looks like
//     an OS pill, not slate-themed
//   - Title can't wrap long descriptions sensibly (most browsers truncate
//     after a few lines)
//   - A custom popover gives us viewport-clamped positioning so the
//     tooltip never spills off the right edge inside narrow groups

const TOOLTIP_ELEMENT_ID = "field-tooltip-popover"
const HOVER_DELAY_MILLISECONDS = 200

const tooltipState = {
  hoverTimeoutId: null,
  isAttached: false,
}

const getTooltipElement = () =>
  document.getElementById(TOOLTIP_ELEMENT_ID)

const positionTooltipNear = ({
  tooltipElement,
  anchorElement,
}) => {
  const anchorRectangle =
    anchorElement.getBoundingClientRect()
  const tooltipRectangle =
    tooltipElement.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const verticalGap = 6

  const preferredTop = anchorRectangle.bottom + verticalGap
  const isOverflowingBottom =
    preferredTop + tooltipRectangle.height >
    viewportHeight - 8
  const computedTop = isOverflowingBottom
    ? Math.max(
        8,
        anchorRectangle.top -
          tooltipRectangle.height -
          verticalGap,
      )
    : preferredTop

  const preferredLeft = anchorRectangle.left
  const maxLeft = viewportWidth - tooltipRectangle.width - 8
  const computedLeft = Math.max(
    8,
    Math.min(preferredLeft, maxLeft),
  )

  tooltipElement.style.top = `${computedTop}px`
  tooltipElement.style.left = `${computedLeft}px`
}

const showTooltipFor = ({ anchorElement }) => {
  const tooltipKey = anchorElement.getAttribute(
    "data-tooltip-key",
  )

  if (!tooltipKey) {
    return
  }

  const [commandName, fieldName] = tooltipKey.split(":")
  const description = window.getCommandFieldDescription
    ? window.getCommandFieldDescription({
        commandName,
        fieldName,
      })
    : ""

  if (!description) {
    return
  }

  const tooltipElement = getTooltipElement()

  if (!tooltipElement) {
    return
  }

  tooltipElement.textContent = description
  tooltipElement.classList.remove("hidden")
  // Force a reflow so getBoundingClientRect reports the post-show size,
  // otherwise positionTooltipNear sees 0×0 on the first show.
  tooltipElement.style.top = "-9999px"
  tooltipElement.style.left = "-9999px"
  positionTooltipNear({ tooltipElement, anchorElement })
}

const hideTooltip = () => {
  const tooltipElement = getTooltipElement()

  if (!tooltipElement) {
    return
  }

  tooltipElement.classList.add("hidden")
}

const cancelPendingShow = () => {
  if (tooltipState.hoverTimeoutId !== null) {
    window.clearTimeout(tooltipState.hoverTimeoutId)
    tooltipState.hoverTimeoutId = null
  }
}

const handlePointerOver = (event) => {
  const anchorElement = event.target.closest(
    "[data-tooltip-key]",
  )

  if (!anchorElement) {
    return
  }

  cancelPendingShow()
  tooltipState.hoverTimeoutId = window.setTimeout(() => {
    showTooltipFor({ anchorElement })
  }, HOVER_DELAY_MILLISECONDS)
}

const handlePointerOut = (event) => {
  const anchorElement = event.target.closest(
    "[data-tooltip-key]",
  )

  if (!anchorElement) {
    return
  }

  // Skip when the pointer has merely moved to a child of the anchor —
  // closest() on the relatedTarget tells us whether we're still inside.
  const nextElement = event.relatedTarget
  const stillInsideAnchor =
    nextElement &&
    typeof nextElement.closest === "function" &&
    nextElement.closest("[data-tooltip-key]") ===
      anchorElement

  if (stillInsideAnchor) {
    return
  }

  cancelPendingShow()
  hideTooltip()
}

const handleScrollOrResize = () => {
  cancelPendingShow()
  hideTooltip()
}

const handleClick = (event) => {
  const anchorElement = event.target.closest(
    "[data-tooltip-key]",
  )

  if (!anchorElement) {
    return
  }

  // On touch devices, pointerover doesn't fire. Clicking/tapping the label
  // should immediately show the tooltip. On subsequent clicks, hide it.
  const tooltipElement = getTooltipElement()
  const isShowing =
    tooltipElement &&
    !tooltipElement.classList.contains("hidden")

  if (isShowing) {
    hideTooltip()
  } else {
    cancelPendingShow()
    showTooltipFor({ anchorElement })
  }
}

export function attachFieldTooltipListeners() {
  if (tooltipState.isAttached) {
    return
  }

  tooltipState.isAttached = true

  document.addEventListener(
    "pointerover",
    handlePointerOver,
  )
  document.addEventListener("pointerout", handlePointerOut)
  // Touch and click support: tapping a label on mobile shows the tooltip
  document.addEventListener("click", handleClick)
  // Reposition is overkill for a hover tooltip — just hide on scroll
  // since the anchor moved.
  window.addEventListener("scroll", handleScrollOrResize, {
    capture: true,
  })
  window.addEventListener("resize", handleScrollOrResize)
}
