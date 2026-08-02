import type { LogLine } from "@charcuterie/ui"
import { Accordion, LogViewer } from "@charcuterie/ui"
import type { ReactNode } from "react"
import { useState } from "react"

const LOGS_KEY = "logs"

type DisclosedLogViewerProps = {
  /** Rendered above the pane, inside the panel. */
  actions?: ReactNode
  /** The pane's accessible name. */
  label: string
  lines: LogLine[]
  onExpand?: () => void
  /** The accordion trigger's text. */
  summary: string
}

/**
 * A `LogViewer` inside an `Accordion`, which needs one line of care that
 * neither component can supply on its own.
 *
 * ### `LogViewer` does not follow when it mounts inside a collapsed panel
 *
 * `AccordionSection` renders its panel with `hidden` rather than unmounting
 * it, and says why: "A panel that unmounts loses a scroll position, a
 * partially typed form, and any subscription its content opened — and the
 * fleet's log panes are exactly that."
 *
 * `LogViewer` follows the tail from an effect that reads `scrollHeight`.
 * Inside a `hidden` panel there is no layout, so measured in this app on a
 * 60-line pane:
 *
 * ```
 * while collapsed : scrollTop 0   scrollHeight 0     clientHeight 0
 * after expanding : scrollTop 0   scrollHeight 976   clientHeight 254
 * ```
 *
 * The effect ran once, while `scrollHeight` was `0`, and set `scrollTop = 0`.
 * Its dependencies are `isFollowing` and `shownLines`, neither of which
 * changes when the panel is revealed — so it never runs again and the pane
 * opens showing the **top** of the log.
 *
 * That is mux-magic's original `}, [])` bug, reproduced exactly, by two
 * components whose individual decisions are both right. Nothing errors,
 * nothing warns, and both components' own tests pass: `LogViewer`'s mount
 * visible, `Accordion`'s with content that does not measure itself.
 * **Reported upstream to charcuterie; the component wants an effect keyed on
 * visibility, or an `IntersectionObserver`.**
 *
 * The fix here is to not mount the pane until the section has been opened
 * once, so the effect's single run happens with layout. It stays mounted
 * afterwards, which is what keeps the scroll position across a collapse —
 * the property `AccordionSection` chose `hidden` for.
 */
export const DisclosedLogViewer = ({
  actions,
  label,
  lines,
  onExpand,
  summary,
}: DisclosedLogViewerProps) => {
  const [hasBeenExpanded, setHasBeenExpanded] =
    useState(false)

  return (
    <Accordion
      items={[
        {
          content: (
            <div className="flex flex-col gap-1">
              {actions === undefined ? null : (
                // Above the pane rather than in the trigger: `Accordion`'s
                // trigger is a `<button>`, and a `<button>` inside one is
                // invalid markup browsers repair by hoisting it out.
                <div className="flex justify-end">
                  {actions}
                </div>
              )}

              {hasBeenExpanded ? (
                <LogViewer label={label} lines={lines} />
              ) : null}
            </div>
          ),
          key: LOGS_KEY,
          label: summary,
        },
      ]}
      onChange={(expandedKeys) => {
        if (!expandedKeys.includes(LOGS_KEY)) {
          return
        }

        setHasBeenExpanded(true)
        onExpand?.()
      }}
    />
  )
}
