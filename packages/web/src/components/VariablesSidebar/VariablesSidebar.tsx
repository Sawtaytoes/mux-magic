import { Rail } from "@charcuterie/ui"

import { useResizableRail } from "../../hooks/useResizableRail"
import { SavedTemplatesPanel } from "../SavedTemplates/SavedTemplatesPanel"
import { VariablesPanel } from "../VariablesPanel/VariablesPanel"

// Rendered as a @charcuterie/ui `Rail`: a fixed-width column at `md`+ and a
// relocated strip below it — so Variables *and* Saved Templates stay reachable
// at narrow widths instead of the old `hidden lg:flex` that removed them from
// the DOM entirely (the app's only way to load a template used to vanish).
//
// At `md`+ `useResizableRail` layers on three things the bare Rail lacks: a
// user-draggable, persisted width (an inline `style` width that supersedes the
// Rail's built-in `md:w-64`); a sticky offset so the panel stays in view as the
// sequence list scrolls; and a `max-height` + inner `overflow-y-auto` so a tall
// variable list scrolls *itself* rather than running off the bottom of the
// viewport.
export const VariablesSidebar = () => {
  const { isWideViewport, railStyle, resizeHandleProps } =
    useResizableRail()

  return (
    <Rail
      side="end"
      label="Variables"
      className="bg-surface-sunken"
      style={railStyle}
    >
      {isWideViewport ? (
        <div
          {...resizeHandleProps}
          className="absolute inset-y-0 start-0 z-10 hidden w-1.5 cursor-col-resize touch-none bg-transparent transition-colors hover:bg-intent-accent-border focus-visible:bg-intent-accent-border focus-visible:outline-none md:block"
        />
      ) : null}
      <div className="min-h-0 w-full md:flex-1 md:overflow-y-auto">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-content-secondary">
          Variables
        </h2>
        <VariablesPanel />
        <SavedTemplatesPanel />
      </div>
    </Rail>
  )
}
