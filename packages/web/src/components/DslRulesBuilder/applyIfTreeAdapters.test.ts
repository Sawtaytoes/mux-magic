import { describe, expect, test } from "vitest"

import {
  applyIfNodeToTree,
  serializedTreeToApplyIfNode,
} from "./applyIfTreeAdapters"
import type { ApplyIfNode } from "./types"

describe("round-trips every legacy `applyIf:` shape unchanged", () => {
  const cases: { name: string; node: ApplyIfNode }[] = [
    {
      name: "one clause, one comparator",
      node: { anyStyleMatches: { Fontsize: { gt: 40 } } },
    },
    {
      name: "several clauses (implicit AND)",
      node: {
        allStyleMatches: { MarginV: { gte: 10 } },
        anyStyleMatches: { Fontsize: { gt: 40 } },
        noneStyleMatches: { Bold: { eq: -1 } },
      },
    },
    {
      name: "several fields in one clause",
      node: {
        anyStyleMatches: {
          Fontsize: { gt: 40 },
          MarginL: { lte: 20 },
        },
      },
    },
    {
      name: "a bare string value, which the old row mangled",
      node: { anyStyleMatches: { Fontname: "Arial" } },
    },
  ]

  for (const { name, node } of cases) {
    test(name, () => {
      expect(
        serializedTreeToApplyIfNode(
          applyIfNodeToTree(node),
        ),
      ).toEqual(node)
    })
  }
})

describe("nested `applyIf:`", () => {
  test("round-trips a boolean node", () => {
    const node: ApplyIfNode = {
      any: [
        { anyStyleMatches: { Fontsize: { gt: 40 } } },
        { noneStyleMatches: { Bold: { eq: -1 } } },
      ],
    }

    expect(
      serializedTreeToApplyIfNode(applyIfNodeToTree(node)),
    ).toEqual(node)
  })

  test("an `all` of distinct clauses collapses back to a clause map", () => {
    expect(
      serializedTreeToApplyIfNode(
        applyIfNodeToTree({
          all: [
            { anyStyleMatches: { Fontsize: { gt: 40 } } },
            { noneStyleMatches: { Bold: { eq: -1 } } },
          ],
        }),
      ),
    ).toEqual({
      anyStyleMatches: { Fontsize: { gt: 40 } },
      noneStyleMatches: { Bold: { eq: -1 } },
    })
  })

  test("an empty group is dropped rather than written as `{ all: [] }`", () => {
    // `{ all: [] }` evaluates as vacuously true — the rule would apply
    // to every style row, from a group nobody finished.
    expect(
      serializedTreeToApplyIfNode({
        children: [],
        combinator: "all",
        kind: "group",
      }),
    ).toBeUndefined()
  })

  test("a condition with no field name is skipped", () => {
    expect(
      serializedTreeToApplyIfNode({
        children: [
          {
            children: [
              {
                kind: "leaf",
                value: {
                  field: "",
                  mode: "comparator",
                  operand: 0,
                  verb: "eq",
                },
              },
              {
                kind: "leaf",
                value: {
                  field: "Fontsize",
                  mode: "comparator",
                  operand: 40,
                  verb: "gt",
                },
              },
            ],
            combinator: "anyStyleMatches",
            kind: "group",
          },
        ],
        combinator: "all",
        kind: "group",
      }),
    ).toEqual({
      anyStyleMatches: { Fontsize: { gt: 40 } },
    })
  })
})
