// `WhenNode` (what `step.params.rules` stores and YAML round-trips) ⇄
// `SerializedTree` (what `useTree` holds).
//
// The load-bearing property is in `serializedTreeToWhenNode`: a tree that
// never nests must come back out as **today's clause map**, byte for
// byte. That is what keeps every saved sequence working without a
// migration — the new nested shape is only written when the user actually
// nests something.
import type { SerializedTree } from "@charcuterie/logic"
import { isPlainObject, isRefBody } from "./clauseUtils"
import type {
  WhenBooleanNode,
  WhenClauseValue,
  WhenMap,
  WhenNode,
} from "./types"
import type { WhenCombinator } from "./whenCombinators"
import { getIsBooleanCombinator } from "./whenCombinators"

/**
 * A condition row. Non-uniform by design — `$ref` replaces a whole slot
 * body rather than adding a pair to it, so it cannot be a flag on a kv
 * leaf without making an impossible state representable.
 */
export type WhenLeaf =
  | {
      key: string
      mode: "kv"
      slot: WhenSlot
      value: string
    }
  | { mode: "ref"; ref: string; slot: WhenSlot }

export type WhenSlot = "excludes" | "matches"

export type WhenTree = SerializedTree<
  WhenCombinator,
  WhenLeaf
>

const BOOLEAN_KEYS = ["all", "any", "none"] as const

const getBooleanKey = (node: WhenNode) =>
  BOOLEAN_KEYS.find((key) =>
    Array.isArray((node as Record<string, unknown>)[key]),
  )

const bodyToLeaves = ({
  body,
  slot,
}: {
  body: unknown
  slot: WhenSlot
}): WhenLeaf[] => {
  if (isRefBody(body)) {
    return [
      { mode: "ref", ref: body.$ref, slot },
    ] satisfies WhenLeaf[]
  }

  if (!isPlainObject(body)) {
    return []
  }

  return Object.entries(body).map(([key, value]) => ({
    key,
    mode: "kv" as const,
    slot,
    value: String(value),
  }))
}

const clauseToLeaves = (
  clause: WhenClauseValue,
): WhenLeaf[] => {
  const candidate = clause as Record<string, unknown>

  // Shorthand: a bare key→value map is sugar for `matches:`, the same
  // reading `splitClause` does in the evaluator.
  const isShorthand = !(
    "matches" in candidate || "excludes" in candidate
  )

  if (isShorthand) {
    return bodyToLeaves({ body: clause, slot: "matches" })
  }

  return [
    ...bodyToLeaves({
      body: candidate.matches,
      slot: "matches",
    }),
    ...bodyToLeaves({
      body: candidate.excludes,
      slot: "excludes",
    }),
  ]
}

const nodeToTreeNode = (
  node: WhenNode,
): WhenTree | { kind: "leaf"; value: WhenLeaf } => {
  const booleanKey = getBooleanKey(node)

  if (booleanKey) {
    return {
      children: (
        (node as WhenBooleanNode)[booleanKey] ?? []
      ).map(nodeToTreeNode),
      combinator: booleanKey,
      kind: "group",
    }
  }

  // A clause map is an implicit AND over its clauses, so each clause
  // becomes a group and the map becomes an `all` over them.
  //
  // A SINGLE-clause map returns that group bare, with no `all` wrapper.
  // That is not a tidy-up: `{ all: [ {anyStyle}, {allScriptInfo} ] }`
  // must land as one `all` over two clause groups so it can collapse
  // back to a flat clause map. Wrapping each child would produce
  // `all > [all > [anyStyle], all > [allScriptInfo]]`, which no longer
  // looks like a clause map and would be written out in the new nested
  // form — silently rewriting a rule that did not need it.
  const clauseGroups = Object.entries(node as WhenMap)
    .filter(([, clause]) => clause !== undefined)
    .map(([clauseName, clause]) => ({
      children: clauseToLeaves(
        clause as WhenClauseValue,
      ).map((value) => ({
        kind: "leaf" as const,
        value,
      })),
      combinator: clauseName as WhenCombinator,
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

export const whenNodeToTree = (
  node: WhenNode | undefined,
): WhenTree => {
  if (!node) {
    return {
      children: [],
      combinator: "all",
      kind: "group",
    }
  }

  const treeNode = nodeToTreeNode(node)

  // The root must be a group; a bare leaf cannot happen from a clause
  // map, but the type allows it, so wrap rather than cast.
  return treeNode.kind === "group"
    ? treeNode
    : {
        children: [treeNode],
        combinator: "all",
        kind: "group",
      }
}

type TreeNode = WhenTree["children"][number]

const leavesToClause = (
  children: readonly TreeNode[],
): WhenClauseValue | undefined => {
  const matches: Record<string, string> = {}
  const excludes: Record<string, string> = {}
  let matchesRef: string | undefined
  let excludesRef: string | undefined

  for (const child of children) {
    if (child.kind !== "leaf") {
      continue
    }

    const leaf = child.value

    if (leaf.mode === "ref") {
      if (leaf.slot === "matches") {
        matchesRef = leaf.ref
      } else {
        excludesRef = leaf.ref
      }
      continue
    }

    if (leaf.key === "") {
      continue
    }

    if (leaf.slot === "matches") {
      matches[leaf.key] = leaf.value
    } else {
      excludes[leaf.key] = leaf.value
    }
  }

  const matchesBody = matchesRef
    ? { $ref: matchesRef }
    : Object.keys(matches).length > 0
      ? matches
      : undefined

  const excludesBody = excludesRef
    ? { $ref: excludesRef }
    : Object.keys(excludes).length > 0
      ? excludes
      : undefined

  if (!matchesBody && !excludesBody) {
    return undefined
  }

  // Same shorthand collapse `compactWhenClause` has always written, so a
  // matches-only clause stays a bare map in YAML.
  if (excludesBody === undefined && !matchesRef) {
    return matchesBody as WhenClauseValue
  }

  return {
    ...(matchesBody ? { matches: matchesBody } : {}),
    ...(excludesBody ? { excludes: excludesBody } : {}),
  } as WhenClauseValue
}

/**
 * True when this `all` group is just a clause map wearing a wrapper —
 * every child a distinct, non-nested clause group. That is the shape
 * every pre-nesting rule has, and recognising it is what lets the
 * adapter write the old format back out unchanged.
 */
const getIsClauseMapGroup = (node: WhenTree) => {
  if (node.combinator !== "all") {
    return false
  }

  const seenClauses = new Set<string>()

  return node.children.every((child) => {
    if (
      child.kind !== "group" ||
      getIsBooleanCombinator(child.combinator) ||
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

const treeNodeToWhenNode = (
  node: TreeNode,
): WhenNode | undefined => {
  if (node.kind === "leaf") {
    // A condition directly under a boolean group has no clause to belong
    // to; it cannot be represented and is dropped rather than guessed at.
    return undefined
  }

  if (getIsBooleanCombinator(node.combinator)) {
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
      ) as WhenMap

      return Object.keys(clauseMap).length > 0
        ? clauseMap
        : undefined
    }

    const children = node.children
      .map(treeNodeToWhenNode)
      .filter(
        (child): child is WhenNode => child !== undefined,
      )

    // A boolean node with nothing left to join is not a condition. It
    // would otherwise serialize as `{ all: [] }`, which the evaluator
    // reads as vacuously TRUE — a rule that fires on every batch, from
    // a group the user only half-built.
    return children.length === 0
      ? undefined
      : ({
          [node.combinator]: children,
        } as WhenBooleanNode)
  }

  const clause = leavesToClause(node.children)

  return clause === undefined
    ? undefined
    : ({ [node.combinator]: clause } as WhenMap)
}

export const serializedTreeToWhenNode = (
  tree: WhenTree,
): WhenNode | undefined => {
  const node = treeNodeToWhenNode(tree)

  if (!node) {
    return undefined
  }

  // An empty `when:` is `undefined`, not `{}` — `setParam` deletes the
  // key on undefined, which is what keeps the YAML clean.
  return Object.keys(node).length > 0 ? node : undefined
}
