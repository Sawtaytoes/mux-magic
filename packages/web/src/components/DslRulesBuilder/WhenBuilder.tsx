import { Accordion } from "@charcuterie/ui"
import { useEffect, useRef, useState } from "react"

import { setRuleWhen } from "./ruleMutations"
import type {
  DslRule,
  OpenDetailsKeys,
  PredicatesMap,
  WhenNode,
} from "./types"
import { WhenTreeEditor } from "./WhenTreeEditor"

type WhenBuilderProps = {
  rules: DslRule[]
  ruleIndex: number
  whenValue: WhenNode | undefined
  predicates: PredicatesMap
  isReadOnly: boolean
  stepId: string
  openDetailsKeys: OpenDetailsKeys
  onToggleDetails: (
    detailsKey: string,
    isOpen: boolean,
  ) => void
  onCommitRules: (nextRules: DslRule[]) => void
}

export const WhenBuilder = ({
  isReadOnly,
  onCommitRules,
  onToggleDetails,
  openDetailsKeys,
  predicates,
  ruleIndex,
  rules,
  stepId,
  whenValue,
}: WhenBuilderProps) => {
  const detailsKey = `${stepId}:when:${ruleIndex}`
  const isOpen =
    !isReadOnly && openDetailsKeys.has(detailsKey)

  const externalWhen = JSON.stringify(whenValue ?? null)

  // The tree is the source of truth while the editor is mounted, so a
  // `when:` arriving from outside — an undo, a loaded template, a rule
  // reordered above this one — has to remount it. Our OWN writes come
  // back through the same prop, and remounting on those would tear the
  // editor down mid-edit and drop focus, so the value we last emitted is
  // remembered and ignored on the way back in.
  const lastEmittedRef = useRef<string | null>(null)
  const [remountCount, setRemountCount] = useState(0)

  useEffect(() => {
    if (lastEmittedRef.current === null) {
      return
    }

    if (lastEmittedRef.current !== externalWhen) {
      lastEmittedRef.current = null
      setRemountCount((previousCount) => previousCount + 1)
    }
  }, [externalWhen])

  const handleCommitWhen = (
    nextWhen: WhenNode | undefined,
  ) => {
    lastEmittedRef.current = JSON.stringify(
      nextWhen ?? null,
    )

    onCommitRules(
      setRuleWhen({ nextWhen, ruleIndex, rules }),
    )
  }

  return (
    <Accordion
      className="mt-2"
      expandedKeys={isOpen ? [detailsKey] : []}
      items={[
        {
          content: (
            <WhenTreeEditor
              isReadOnly={isReadOnly}
              key={`${detailsKey}:${remountCount}`}
              onCommitWhen={handleCommitWhen}
              predicateNames={Object.keys(predicates)}
              whenValue={whenValue}
            />
          ),
          // A read-only preview's section is DISABLED, not merely
          // collapsed — a `<summary>` cannot be disabled, so the old
          // `<details>` rendered exactly like a working disclosure and
          // did nothing when clicked.
          isDisabled: isReadOnly,
          key: detailsKey,
          label:
            "When (advanced — leave empty to always fire)",
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
