import { useTree } from "@charcuterie/logic"
import { QueryBuilder } from "@charcuterie/ui"
import { useRef } from "react"

import type { WhenNode } from "./types"
import { WhenCombinatorPickers } from "./WhenCombinatorPickers"
import { WhenLeafRow } from "./WhenLeafRow"
import type { WhenCombinator } from "./whenCombinators"
import { WHEN_COMBINATOR_OPTIONS } from "./whenCombinators"
import type { WhenLeaf } from "./whenTreeAdapters"
import {
  serializedTreeToWhenNode,
  whenNodeToTree,
} from "./whenTreeAdapters"

/**
 * The tree editor itself, mounted only while the section is open.
 *
 * `useTree` builds its state once and never rebuilds — recreating it
 * would throw away the tree it exists to hold. So this component owns
 * the tree for as long as it is mounted, and the parent remounts it (by
 * `key`) whenever `when:` changes from the outside. See the parent for
 * how "from the outside" is told apart from our own writes.
 */
export const WhenTreeEditor = ({
  isReadOnly,
  onCommitWhen,
  predicateNames,
  whenValue,
}: {
  isReadOnly: boolean
  onCommitWhen: (nextWhen: WhenNode | undefined) => void
  predicateNames: readonly string[]
  whenValue: WhenNode | undefined
}) => {
  const treeRef = useRef<{
    serialize: () => ReturnType<typeof whenNodeToTree>
  } | null>(null)

  const tree = useTree<WhenCombinator, WhenLeaf>({
    // A fresh group asks about style rows, which is what almost every
    // rule in the fleet's own templates opens with.
    defaultCombinator: "anyStyle",
    initialTree: whenNodeToTree(whenValue),
    onChange: () => {
      const currentTree = treeRef.current

      if (currentTree) {
        onCommitWhen(
          serializedTreeToWhenNode(currentTree.serialize()),
        )
      }
    },
  })

  treeRef.current = tree

  return (
    <QueryBuilder
      combinatorOptions={WHEN_COMBINATOR_OPTIONS}
      createLeafValue={() => ({
        key: "",
        mode: "kv" as const,
        slot: "matches" as const,
        value: "",
      })}
      labels={{
        addGroup: "Group",
        addLeaf: "Condition",
        match: "Match",
        removeGroup: "Remove group",
        removeLeaf: "Remove condition",
      }}
      renderCombinator={({ onChange, value }) => (
        <WhenCombinatorPickers
          isDisabled={isReadOnly}
          onChange={onChange}
          value={value}
        />
      )}
      renderLeaf={({ onChange, value }) => (
        <WhenLeafRow
          isReadOnly={isReadOnly}
          onChange={onChange}
          predicateNames={predicateNames}
          value={value}
        />
      )}
      tree={tree}
    />
  )
}
