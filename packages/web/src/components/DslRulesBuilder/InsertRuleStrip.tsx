import type { RuleType } from "./types"

type InsertRuleStripProps = {
  onAddRule: (ruleType: RuleType) => void
}

export const InsertRuleStrip = ({
  onAddRule,
}: InsertRuleStripProps) => (
  <div className="flex items-center gap-1 mt-1">
    <div className="flex-1 h-px bg-slate-700/40" />
    <button
      type="button"
      onClick={() => {
        onAddRule("setScriptInfo")
      }}
      className="text-[10px] text-slate-500 hover:text-blue-400 px-1.5 py-0.5 rounded border border-transparent hover:border-blue-500/40"
    >
      + setScriptInfo
    </button>
    <button
      type="button"
      onClick={() => {
        onAddRule("scaleResolution")
      }}
      className="text-[10px] text-slate-500 hover:text-blue-400 px-1.5 py-0.5 rounded border border-transparent hover:border-blue-500/40"
    >
      + scaleResolution
    </button>
    <button
      type="button"
      onClick={() => {
        onAddRule("setStyleFields")
      }}
      className="text-[10px] text-slate-500 hover:text-blue-400 px-1.5 py-0.5 rounded border border-transparent hover:border-blue-500/40"
    >
      + setStyleFields
    </button>
    <div className="flex-1 h-px bg-slate-700/40" />
  </div>
)
