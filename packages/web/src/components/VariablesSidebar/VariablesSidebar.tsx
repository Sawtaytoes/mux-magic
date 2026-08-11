import { Rail } from "@charcuterie/ui"

import { SavedTemplatesPanel } from "../SavedTemplates/SavedTemplatesPanel"
import { VariablesPanel } from "../VariablesPanel/VariablesPanel"

// Rendered as a @charcuterie/ui `Rail`: a fixed-width column at `md`+ and a
// relocated strip below it — so Variables *and* Saved Templates stay reachable
// at narrow widths instead of the old `hidden lg:flex` that removed them from
// the DOM entirely (the app's only way to load a template used to vanish).
export const VariablesSidebar = () => (
  <Rail
    side="end"
    label="Variables"
    className="bg-surface-sunken md:overflow-y-auto"
  >
    <div>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-content-secondary">
        Variables
      </h2>
      <VariablesPanel />
      <SavedTemplatesPanel />
    </div>
  </Rail>
)
