import { describe, expect, test } from "vitest"
import { parentPathFromInput } from "./parentPathFromInput"

describe("parentPathFromInput", () => {
  test("bare drive root keeps trailing backslash so it stays absolute", () => {
    // Regression: `G:\` previously sliced to `"G:"`, which `path.isAbsolute`
    // rejects on Windows as drive-relative.
    expect(parentPathFromInput("G:\\")).toEqual({
      parentPath: "G:\\",
      query: "",
    })
  })

  test("drive-rooted child uses drive root as parent and child as query", () => {
    expect(parentPathFromInput("C:\\Users")).toEqual({
      parentPath: "C:\\",
      query: "Users",
    })
  })

  test("nested windows path splits at last separator", () => {
    expect(parentPathFromInput("C:\\Users\\foo")).toEqual({
      parentPath: "C:\\Users",
      query: "foo",
    })
  })

  test("posix root + child", () => {
    expect(parentPathFromInput("/foo")).toEqual({
      parentPath: "/foo",
      query: "foo",
    })
  })

  test("posix nested path", () => {
    expect(parentPathFromInput("/mnt/media")).toEqual({
      parentPath: "/mnt",
      query: "media",
    })
  })

  test("trailing separator means parent listed with no filter", () => {
    expect(parentPathFromInput("/mnt/")).toEqual({
      parentPath: "/mnt",
      query: "",
    })
  })

  test("forward-slash variant of bare drive also preserved", () => {
    expect(parentPathFromInput("D:/")).toEqual({
      parentPath: "D:\\",
      query: "",
    })
  })
})
