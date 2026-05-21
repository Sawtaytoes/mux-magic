import type { FileInfo } from "@mux-magic/tools"
import { firstValueFrom, of } from "rxjs"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

vi.mock("../tools/getUserSearchInput.js", () => ({
  getUserSearchInput: vi.fn(),
}))

const { getUserSearchInput } = await import(
  "../tools/getUserSearchInput.js"
)

const {
  groupRenamesByTarget,
  promoteRenameToFront,
  reorderForDuplicatePrompts,
} = await import(
  "./nameSpecialFeaturesDvdCompareTmdb.duplicates.js"
)

const makeFileInfo = (filename: string): FileInfo => ({
  filename,
  fullPath: `/work/${filename}`,
  renameFile: () =>
    ({}) as ReturnType<FileInfo["renameFile"]>,
})

describe(groupRenamesByTarget.name, () => {
  test("groups multiple renames sharing the same target and preserves input order within each group", () => {
    const renameOne = {
      renamedFilename: "Behind the Scenes -behindthescenes",
    }
    const renameTwo = {
      renamedFilename: "Trailer -trailer",
    }
    const renameThree = {
      renamedFilename: "Behind the Scenes -behindthescenes",
    }
    const groups = groupRenamesByTarget([
      renameOne,
      renameTwo,
      renameThree,
    ])
    expect(
      groups.get("Behind the Scenes -behindthescenes"),
    ).toEqual([renameOne, renameThree])
    expect(groups.get("Trailer -trailer")).toEqual([
      renameTwo,
    ])
  })

  test("returns single-entry groups for non-duplicate targets", () => {
    const renameOne = { renamedFilename: "A" }
    const renameTwo = { renamedFilename: "B" }
    const groups = groupRenamesByTarget([
      renameOne,
      renameTwo,
    ])
    expect(groups.size).toBe(2)
  })

  test("does not mutate the input array (worker 25: no-array-mutation guarantee)", () => {
    const inputs = [
      { renamedFilename: "A" },
      { renamedFilename: "A" },
      { renamedFilename: "B" },
    ]
    const snapshot = inputs.slice()
    groupRenamesByTarget(inputs)
    expect(inputs).toEqual(snapshot)
  })
})

describe(promoteRenameToFront.name, () => {
  test("moves the chosen entry to the front while preserving the relative order of the rest", () => {
    const first = { id: 1 }
    const second = { id: 2 }
    const third = { id: 3 }
    expect(
      promoteRenameToFront([first, second, third], second),
    ).toEqual([second, first, third])
  })

  test("returns the array unchanged when the chosen entry is not present", () => {
    const first = { id: 1 }
    const stranger = { id: 99 }
    expect(promoteRenameToFront([first], stranger)).toEqual(
      [first],
    )
  })

  test("returns the array unchanged when the chosen entry is already at the front", () => {
    const first = { id: 1 }
    const second = { id: 2 }
    expect(
      promoteRenameToFront([first, second], first),
    ).toEqual([first, second])
  })
})

describe(reorderForDuplicatePrompts.name, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test("passes through unchanged when there are no duplicate targets (no prompt fired)", async () => {
    const renames = [
      {
        fileInfo: makeFileInfo("a.mkv"),
        renamedFilename: "Trailer -trailer",
      },
      {
        fileInfo: makeFileInfo("b.mkv"),
        renamedFilename: "Featurette -featurette",
      },
    ]
    const result = await firstValueFrom(
      reorderForDuplicatePrompts(renames),
    )
    expect(result.kept).toEqual(renames)
    expect(result.droppedFullPaths).toEqual([])
    expect(getUserSearchInput).not.toHaveBeenCalled()
  })

  test("drops non-chosen group members AND surfaces their fullPaths so the orchestrator can treat them as unnamed (Smart Match + UNNAMED-FEATURES/ bucket)", async () => {
    const renames = [
      {
        fileInfo: makeFileInfo("disc-a.mkv"),
        renamedFilename:
          "Behind the Scenes -behindthescenes",
      },
      {
        fileInfo: makeFileInfo("disc-b.mkv"),
        renamedFilename:
          "Behind the Scenes -behindthescenes",
      },
      {
        fileInfo: makeFileInfo("c.mkv"),
        renamedFilename: "Trailer -trailer",
      },
    ]
    // User picks index 0 (disc-a) as the real Behind the Scenes;
    // disc-b should be dropped from the rename list AND reported in
    // droppedFullPaths so the orchestrator can treat it as unnamed —
    // counted in the summary, surfaced in Smart Match, and bucketed
    // into UNNAMED-FEATURES/ alongside other unmatched files.
    vi.mocked(getUserSearchInput).mockReturnValue(of(0))
    const result = await firstValueFrom(
      reorderForDuplicatePrompts(renames),
    )
    expect(
      result.kept.map((rename) => rename.fileInfo.filename),
    ).toEqual(["disc-a.mkv", "c.mkv"])
    expect(result.droppedFullPaths).toEqual([
      "/work/disc-b.mkv",
    ])
  })

  test("preserves every entry AND emits no droppedFullPaths when the user skips (selectedIndex === -1)", async () => {
    const renames = [
      {
        fileInfo: makeFileInfo("disc-a.mkv"),
        renamedFilename:
          "Behind the Scenes -behindthescenes",
      },
      {
        fileInfo: makeFileInfo("disc-b.mkv"),
        renamedFilename:
          "Behind the Scenes -behindthescenes",
      },
    ]
    vi.mocked(getUserSearchInput).mockReturnValue(of(-1))
    const result = await firstValueFrom(
      reorderForDuplicatePrompts(renames),
    )
    expect(
      result.kept.map((rename) => rename.fileInfo.filename),
    ).toEqual(["disc-a.mkv", "disc-b.mkv"])
    expect(result.droppedFullPaths).toEqual([])
  })
})
