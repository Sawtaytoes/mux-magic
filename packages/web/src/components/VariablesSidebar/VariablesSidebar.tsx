import { SavedTemplatesPanel } from "../SavedTemplates/SavedTemplatesPanel"
import { VariablesPanel } from "../VariablesPanel/VariablesPanel"

export const VariablesSidebar = () => (
  <aside
    className="hidden lg:flex flex-col w-72 shrink-0 border-l border-slate-700 bg-slate-900/50 overflow-y-auto"
    aria-label="Variables"
  >
    <div className="px-4 py-3 border-b border-slate-700 shrink-0">
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
        Variables
      </h2>
    </div>
    <div className="px-4 py-3">
      <VariablesPanel />
      <SavedTemplatesPanel />
    </div>
  </aside>
)
