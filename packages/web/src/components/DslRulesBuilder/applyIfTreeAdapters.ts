// `ApplyIfNode` ⇄ `SerializedTree`, the `applyIf` twin of
// `whenTreeAdapters`. Same guarantee: a tree that never nests comes back
// out as today's clause map.
//
// `applyIf` is simpler than `when` in two ways — every clause is
// style-scoped (there is no scriptInfo axis) and there is no
// matches/excludes split — and harder in one: a field's value may be a
// comparator object OR a bare string, and the row this replaces silently
// mangled the string case.
import type { SerializedTree } from "@charcuterie/logic"
import type { ApplyIfCombinator } from "./applyIfCombinators"
import { getIsBooleanApplyIfCombinator } from "./applyIfCombinators"
import { isPlainObject } from "./clauseUtils"
import type {
  ApplyIfBooleanNode,
  ApplyIfEntry,
  ApplyIfMap,
  ApplyIfNode,
  ComparatorVerb,
} from "./types"
import { COMPARATOR_VERBS } from "./types"

/**
 * A condition row.
 *
 * The `literal` arm exists because `ApplyIfFieldMatch` in the DSL is
 * `string | ComparatorMatch`, and `ApplyIfEntryRow` never handled the
 * string: it read `Object.keys(entryValue)[0]` as the verb, which for
 * the string `"60"` yields `"0"` — a comparator that does not exist.
 * Modelling the literal keeps such a value intact through an edit
 * instead of rewriting it into nonsense.
 */
export type ApplyIfLeaf =
  | {
      field: string
      mode: "comparator"
      operand: number
      verb: ComparatorVerb
    }
  | { field: string; mode: "literal"; value: string }

export type ApplyIfTree = SerializedTree<
  ApplyIfCombinator,
  ApplyIfLeaf
>

const BOOLEAN_KEYS = ["all", "any", "none"] as const

const getBooleanKey = (node: ApplyIfNode) =>
  BOOLEAN_KEYS.find((key) =>
    Array.isArray((node as Record<string, unknown>)[key]),
  )

const entryToLeaf = ({
  entry,
  field,
}: {
  entry: unknown
  field: string
}): ApplyIfLeaf => {
  if (!isPlainObject(entry)) {
    return { field, mode: "literal", value: String(entry) }
  }

  const verb = COMPARATOR_VERBS.find(
    (comparatorVerb) => comparatorVerb in entry,
  )

  if (!verb) {
    return { field, mode: "literal", value: "" }
  }

  return {
    field,
    mode: "comparator",
    operand: Number(
      (entry as Record<string, unknown>)[verb] ?? 0,
    ),
    verb,
  }
}

const clauseToLeaves = (
  clause: Record<string, unknown>,
): ApplyIfLeaf[] =>
  Object.entries(clause).map(([field, entry]) =>
    entryToLeaf({ entry, field }),
  )

const nodeToTreeNode = (
  node: ApplyIfNode,
): ApplyIfTree | { kind: "leaf"; value: ApplyIfLeaf } => {
  const booleanKey = getBooleanKey(node)

  if (booleanKey) {
    return {
      children: (
        (node as ApplyIfBooleanNode)[booleanKey] ?? []
      ).map(nodeToTreeNode),
      combinator: booleanKey,
      kind: "group",
    }
  }

  // Single-clause maps stay unwrapped — see `whenTreeAdapters` for why
  // an extra `all` here would rewrite flat rules into the nested form.
  const clauseGroups = Object.entries(node as ApplyIfMap)
    .filter(([, clause]) => clause !== undefined)
    .map(([clauseName, clause]) => ({
      children: clauseToLeaves(
        clause as Record<string, unknown>,
      ).map((value) => ({
        kind: "leaf" as const,
        value,
      })),
      combinator: clauseName as ApplyIfCombinator,
      kind: "group" as const,
    }))

  const [onlyClauseGroup] = clauseGroups

  return clauseGroups.length === 1 && onlyClauseGroup
    ? onlyClauseGroup
    : {
        children: clauseGroups,
        combinator: "all",
        kind: "group",
      }
}

export const applyIfNodeToTree = (
  node: ApplyIfNode | undefined,
): ApplyIfTree => {
  if (!node) {
    return {
      children: [],
      combinator: "all",
      kind: "group",
    }
  }

  const treeNode = nodeToTreeNode(node)

  return treeNode.kind === "group"
    ? treeNode
    : {
        children: [treeNode],
        combinator: "all",
        kind: "group",
      }
}

type TreeNode = ApplyIfTree["children"][number]

const leavesToClause = (
  children: readonly TreeNode[],
): Record<string, ApplyIfEntry | string> | undefined => {
  const clause: Record<string, ApplyIfEntry | string> = {}

  for (const child of children) {
    if (child.kind !== "leaf" || child.value.field === "") {
      continue
    }

    const leaf = child.value

    clause[leaf.field] =
      leaf.mode === "literal"
        ? leaf.value
        : ({ [leaf.verb]: leaf.operand } as ApplyIfEntry)
  }

  return Object.keys(clause).length > 0 ? clause : undefined
}

const getIsClauseMapGroup = (node: ApplyIfTree) => {
  if (node.combinator !== "all") {
    return false
  }

  const seenClauses = new Set<string>()

  return node.children.every((child) => {
    if (
      child.kind !== "group" ||
      getIsBooleanApplyIfCombinator(child.combinator) ||
      seenClauses.has(child.combinator) ||
      child.children.some(
        (grandChild) => grandChild.kind === "group",
      )
    ) {
      return false
    }

    seenClauses.add(child.combinator)
    return true
  })
}

const treeNodeToApplyIfNode = (
  node: TreeNode,
): ApplyIfNode | undefined => {
  if (node.kind === "leaf") {
    return undefined
  }

  if (getIsBooleanApplyIfCombinator(node.combinator)) {
    if (getIsClauseMapGroup(node)) {
      const clauseMap = Object.fromEntries(
        node.children.flatMap((child) => {
          if (child.kind !== "group") {
            return []
          }

          const clause = leavesToClause(child.children)

          return clause === undefined
            ? []
            : [[child.combinator, clause]]
        }),
      ) as ApplyIfMap

      return Object.keys(clauseMap).length > 0
        ? clauseMap
        : undefined
    }

    const children = node.children
      .map(treeNodeToApplyIfNode)
      .filter(
        (child): child is ApplyIfNode =>
          child !== undefined,
      )

    // An empty boolean node reads as vacuously true to the evaluator —
    // a rule applied to every style row, from a group nobody finished.
    return children.length === 0
      ? undefined
      : ({
          [node.combinator]: children,
        } as ApplyIfBooleanNode)
  }

  const clause = leavesToClause(node.children)

  return clause === undefined
    ? undefined
    : ({ [node.combinator]: clause } as ApplyIfMap)
}

export const serializedTreeToApplyIfNode = (
  tree: ApplyIfTree,
): ApplyIfNode | undefined => {
  const node = treeNodeToApplyIfNode(tree)

  if (!node) {
    return undefined
  }

  return Object.keys(node).length > 0 ? node : undefined
}
