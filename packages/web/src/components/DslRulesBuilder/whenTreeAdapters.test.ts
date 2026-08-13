import { describe, expect, test } from "vitest"

import type { WhenNode } from "./types"
import {
  serializedTreeToWhenNode,
  whenNodeToTree,
} from "./whenTreeAdapters"

// The migration's central promise: a `when:` that does not nest must come
// back out in EXACTLY the shape it went in, so no saved sequence needs a
// migration and `packages/core` keeps reading what it always read.
describe("round-trips every legacy `when:` shape unchanged", () => {
  const cases: { name: string; node: WhenNode }[] = [
    {
      name: "shorthand clause (bare key→value map)",
      node: { anyStyle: { Fontname: "Arial" } },
    },
    {
      name: "explicit matches + excludes",
      node: {
        anyStyle: {
          excludes: { Bold: "-1" },
          matches: { Fontname: "Arial" },
        },
      },
    },
    {
      name: "several clauses (implicit AND)",
      node: {
        allScriptInfo: { PlayResX: "1920" },
        anyStyle: { Fontname: "Arial" },
        noneStyle: { Fontname: "Comic Sans MS" },
      },
    },
    {
      name: "$ref in a slot",
      node: { anyStyle: { matches: { $ref: "hdSource" } } },
    },
    {
      name: "$ref in excludes alongside inline matches",
      node: {
        anyStyle: {
          excludes: { $ref: "signStyles" },
          matches: { Fontname: "Arial" },
        },
      },
    },
    {
      name: "notAllScriptInfo — the clause with no style twin",
      node: { notAllScriptInfo: { PlayResX: "1920" } },
    },
    {
      name: "multiple pairs in one clause (ANDed against one row)",
      node: {
        anyStyle: { Bold: "0", Fontname: "Arial" },
      },
    },
  ]

  for (const { name, node } of cases) {
    test(name, () => {
      expect(
        serializedTreeToWhenNode(whenNodeToTree(node)),
      ).toEqual(node)
    })
  }
})

describe("nested `when:`", () => {
  test("round-trips a boolean node", () => {
    const node: WhenNode = {
      any: [
        { anyStyle: { Fontname: "Arial" } },
        { noneScriptInfo: { PlayResX: "1920" } },
      ],
    }

    expect(
      serializedTreeToWhenNode(whenNodeToTree(node)),
    ).toEqual(node)
  })

  test("round-trips boolean nodes inside boolean nodes", () => {
    const node: WhenNode = {
      all: [
        { anyStyle: { Fontname: "Arial" } },
        {
          any: [
            { allScriptInfo: { PlayResX: "1920" } },
            { noneStyle: { Bold: "-1" } },
          ],
        },
      ],
    }

    expect(
      serializedTreeToWhenNode(whenNodeToTree(node)),
    ).toEqual(node)
  })

  test("an `all` of distinct clauses collapses back to a clause map, not a boolean node", () => {
    // The asymmetry that makes backward compatibility work: the editor
    // always builds an `all` root, but a flat one is written out as the
    // old format rather than as `{ all: [...] }`.
    const node: WhenNode = {
      all: [
        { anyStyle: { Fontname: "Arial" } },
        { allScriptInfo: { PlayResX: "1920" } },
      ],
    }

    expect(
      serializedTreeToWhenNode(whenNodeToTree(node)),
    ).toEqual({
      allScriptInfo: { PlayResX: "1920" },
      anyStyle: { Fontname: "Arial" },
    })
  })

  test("an `all` repeating a clause stays a boolean node", () => {
    // Two `anyStyle` groups cannot be one clause map — a map has one key
    // per clause — so the nested form is the only honest encoding.
    const node: WhenNode = {
      all: [
        { anyStyle: { Fontname: "Arial" } },
        { anyStyle: { Bold: "-1" } },
      ],
    }

    expect(
      serializedTreeToWhenNode(whenNodeToTree(node)),
    ).toEqual(node)
  })
})

describe("empty and partial trees", () => {
  test("no `when:` becomes an empty root group and back to undefined", () => {
    expect(
      serializedTreeToWhenNode(whenNodeToTree(undefined)),
    ).toBeUndefined()
  })

  test("a clause with no usable conditions is dropped, not written empty", () => {
    expect(
      serializedTreeToWhenNode({
        children: [
          {
            children: [],
            combinator: "anyStyle",
            kind: "group",
          },
        ],
        combinator: "all",
        kind: "group",
      }),
    ).toBeUndefined()
  })

  test("a half-typed condition is skipped rather than written as an empty key", () => {
    expect(
      serializedTreeToWhenNode({
        children: [
          {
            children: [
              {
                kind: "leaf",
                value: {
                  key: "",
                  mode: "kv",
                  slot: "matches",
                  value: "Arial",
                },
              },
              {
                kind: "leaf",
                value: {
                  key: "Bold",
                  mode: "kv",
                  slot: "matches",
                  value: "0",
                },
              },
            ],
            combinator: "anyStyle",
            kind: "group",
          },
        ],
        combinator: "all",
        kind: "group",
      }),
    ).toEqual({ anyStyle: { Bold: "0" } })
  })

  test("a condition stranded directly under a boolean group is dropped", () => {
    // It has no clause to belong to, so there is nothing to write. Better
    // to lose the half-built row than to invent a clause for it.
    expect(
      serializedTreeToWhenNode({
        children: [
          {
            kind: "leaf",
            value: {
              key: "Fontname",
              mode: "kv",
              slot: "matches",
              value: "Arial",
            },
          },
        ],
        combinator: "all",
        kind: "group",
      }),
    ).toBeUndefined()
  })
})
