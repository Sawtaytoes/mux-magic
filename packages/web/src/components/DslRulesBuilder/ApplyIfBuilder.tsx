import { Accordion } from "@charcuterie/ui"
import { useEffect, useRef, useState } from "react"
import { ApplyIfTreeEditor } from "./ApplyIfTreeEditor"
import { setRuleApplyIf } from "./ruleMutations"
import type {
  ApplyIfNode,
  DslRule,
  OpenDetailsKeys,
} from "./types"

type ApplyIfBuilderProps = {
  rules: DslRule[]
  ruleIndex: number
  applyIfValue: ApplyIfNode | undefined
  isReadOnly: boolean
  stepId: string
  openDetailsKeys: OpenDetailsKeys
  onToggleDetails: (
    detailsKey: string,
    isOpen: boolean,
  ) => void
  onCommitRules: (nextRules: DslRule[]) => void
}

export const ApplyIfBuilder = ({
  applyIfValue,
  isReadOnly,
  onCommitRules,
  onToggleDetails,
  openDetailsKeys,
  ruleIndex,
  rules,
  stepId,
}: ApplyIfBuilderProps) => {
  const detailsKey = `${stepId}:applyif:${ruleIndex}`
  const isOpen =
    !isReadOnly && openDetailsKeys.has(detailsKey)

  const externalApplyIf = JSON.stringify(
    applyIfValue ?? null,
  )

  // Same external-change remount as `WhenBuilder`, for the same reason.
  const lastEmittedRef = useRef<string | null>(null)
  const [remountCount, setRemountCount] = useState(0)

  useEffect(() => {
    if (lastEmittedRef.current === null) {
      return
    }

    if (lastEmittedRef.current !== externalApplyIf) {
      lastEmittedRef.current = null
      setRemountCount((previousCount) => previousCount + 1)
    }
  }, [externalApplyIf])

  const handleCommitApplyIf = (
    nextApplyIf: ApplyIfNode | undefined,
  ) => {
    lastEmittedRef.current = JSON.stringify(
      nextApplyIf ?? null,
    )

    onCommitRules(
      setRuleApplyIf({ nextApplyIf, ruleIndex, rules }),
    )
  }

  return (
    <Accordion
      className="mt-2"
      expandedKeys={isOpen ? [detailsKey] : []}
      items={[
        {
          content: (
            <ApplyIfTreeEditor
              applyIfValue={applyIfValue}
              isReadOnly={isReadOnly}
              key={`${detailsKey}:${remountCount}`}
              onCommitApplyIf={handleCommitApplyIf}
            />
          ),
          isDisabled: isReadOnly,
          key: detailsKey,
          label:
            "Apply If (advanced — leave empty to apply to all styles)",
        },
      ]}
      onChange={(expandedKeys) => {
        onToggleDetails(
          detailsKey,
          expandedKeys.includes(detailsKey),
        )
      }}
    />
  )
}
