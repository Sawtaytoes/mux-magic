import { useTree } from "@charcuterie/logic"
import { QueryBuilder } from "@charcuterie/ui"
import { useRef } from "react"

import { ApplyIfCombinatorPickers } from "./ApplyIfCombinatorPickers"
import { ApplyIfLeafRow } from "./ApplyIfLeafRow"
import type { ApplyIfCombinator } from "./applyIfCombinators"
import { APPLY_IF_COMBINATOR_OPTIONS } from "./applyIfCombinators"
import type { ApplyIfLeaf } from "./applyIfTreeAdapters"
import {
  applyIfNodeToTree,
  serializedTreeToApplyIfNode,
} from "./applyIfTreeAdapters"
import type { ApplyIfNode } from "./types"

/** See `WhenBuilder` for why the tree lives in its own mounted child. */
export const ApplyIfTreeEditor = ({
  applyIfValue,
  isReadOnly,
  onCommitApplyIf,
}: {
  applyIfValue: ApplyIfNode | undefined
  isReadOnly: boolean
  onCommitApplyIf: (
    nextApplyIf: ApplyIfNode | undefined,
  ) => void
}) => {
  const treeRef = useRef<{
    serialize: () => ReturnType<typeof applyIfNodeToTree>
  } | null>(null)

  const tree = useTree<ApplyIfCombinator, ApplyIfLeaf>({
    defaultCombinator: "anyStyleMatches",
    initialTree: applyIfNodeToTree(applyIfValue),
    onChange: () => {
      const currentTree = treeRef.current

      if (currentTree) {
        onCommitApplyIf(
          serializedTreeToApplyIfNode(
            currentTree.serialize(),
          ),
        )
      }
    },
  })

  treeRef.current = tree

  return (
    <QueryBuilder
      combinatorOptions={APPLY_IF_COMBINATOR_OPTIONS}
      createLeafValue={() => ({
        field: "",
        mode: "comparator" as const,
        operand: 0,
        verb: "eq" as const,
      })}
      labels={{
        addGroup: "Group",
        addLeaf: "Condition",
        match: "Match",
        removeGroup: "Remove group",
        removeLeaf: "Remove condition",
      }}
      renderCombinator={({ onChange, value }) => (
        <ApplyIfCombinatorPickers
          isDisabled={isReadOnly}
          onChange={onChange}
          value={value}
        />
      )}
      renderLeaf={({ onChange, value }) => (
        <ApplyIfLeafRow
          isReadOnly={isReadOnly}
          onChange={onChange}
          value={value}
        />
      )}
      tree={tree}
    />
  )
}
