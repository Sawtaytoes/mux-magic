import { Button } from "@charcuterie/ui"

import type { RuleType } from "./types"

type InsertRuleStripProps = {
  onAddRule: (ruleType: RuleType) => void
}

export const InsertRuleStrip = ({
  onAddRule,
}: InsertRuleStripProps) => (
  <div className="flex items-center gap-1 mt-1">
    <div className="flex-1 h-px bg-border-subtle" />
    <Button
      intent="neutral"
      appearance="ghost"
      size="sm"
      onClick={() => {
        onAddRule("setScriptInfo")
      }}
    >
      + setScriptInfo
    </Button>
    <Button
      intent="neutral"
      appearance="ghost"
      size="sm"
      onClick={() => {
        onAddRule("scaleResolution")
      }}
    >
      + scaleResolution
    </Button>
    <Button
      intent="neutral"
      appearance="ghost"
      size="sm"
      onClick={() => {
        onAddRule("setStyleFields")
      }}
    >
      + setStyleFields
    </Button>
    <div className="flex-1 h-px bg-border-subtle" />
  </div>
)
