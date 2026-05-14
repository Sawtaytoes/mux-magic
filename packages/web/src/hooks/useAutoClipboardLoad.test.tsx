import { renderHook } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"
import type { Commands } from "../commands/types"
import { commandsAtom } from "../state/commandsAtom"
import { stepsAtom } from "../state/stepsAtom"
import { useAutoClipboardLoad } from "./useAutoClipboardLoad"

const mockCommands: Commands = {
  testCommand: {
    fields: [{ name: "inputPath", type: "path" }],
  },
}

const minimalYaml = `
- command: testCommand
  params:
    inputPath: /some/path
`.trim()

afterEach(() => {
  vi.restoreAllMocks()
})

describe("useAutoClipboardLoad", () => {
  test("returns true and loads steps on valid YAML", async () => {
    vi.spyOn(
      navigator.clipboard,
      "readText",
    ).mockResolvedValue(minimalYaml)

    const store = createStore()
    store.set(commandsAtom, mockCommands)

    const { result } = renderHook(
      () => useAutoClipboardLoad(),
      {
        wrapper: ({ children }) => (
          <Provider store={store}>{children}</Provider>
        ),
      },
    )

    const isLoaded = await result.current()

    expect(isLoaded).toBe(true)
    expect(store.get(stepsAtom)).toHaveLength(1)
    expect(store.get(stepsAtom)[0]).toMatchObject({
      command: "testCommand",
    })
  })

  test("returns false when clipboard contains non-YAML text", async () => {
    vi.spyOn(
      navigator.clipboard,
      "readText",
    ).mockResolvedValue("just plain text without colons")

    const store = createStore()
    store.set(commandsAtom, mockCommands)

    const { result } = renderHook(
      () => useAutoClipboardLoad(),
      {
        wrapper: ({ children }) => (
          <Provider store={store}>{children}</Provider>
        ),
      },
    )

    const isLoaded = await result.current()

    expect(isLoaded).toBe(false)
    expect(store.get(stepsAtom)).toHaveLength(0)
  })

  test("returns false when clipboard is empty", async () => {
    vi.spyOn(
      navigator.clipboard,
      "readText",
    ).mockResolvedValue("")

    const store = createStore()
    store.set(commandsAtom, mockCommands)

    const { result } = renderHook(
      () => useAutoClipboardLoad(),
      {
        wrapper: ({ children }) => (
          <Provider store={store}>{children}</Provider>
        ),
      },
    )

    const isLoaded = await result.current()

    expect(isLoaded).toBe(false)
    expect(store.get(stepsAtom)).toHaveLength(0)
  })

  test("returns false on permission denial", async () => {
    vi.spyOn(
      navigator.clipboard,
      "readText",
    ).mockRejectedValue(
      new DOMException(
        "Read permission denied.",
        "NotAllowedError",
      ),
    )

    const store = createStore()
    store.set(commandsAtom, mockCommands)

    const { result } = renderHook(
      () => useAutoClipboardLoad(),
      {
        wrapper: ({ children }) => (
          <Provider store={store}>{children}</Provider>
        ),
      },
    )

    const isLoaded = await result.current()

    expect(isLoaded).toBe(false)
    expect(store.get(stepsAtom)).toHaveLength(0)
  })

  test("returns false when YAML is invalid", async () => {
    vi.spyOn(
      navigator.clipboard,
      "readText",
    ).mockResolvedValue("not: valid: yaml: {{{{")

    const store = createStore()
    store.set(commandsAtom, mockCommands)

    const { result } = renderHook(
      () => useAutoClipboardLoad(),
      {
        wrapper: ({ children }) => (
          <Provider store={store}>{children}</Provider>
        ),
      },
    )

    const isLoaded = await result.current()

    expect(isLoaded).toBe(false)
    expect(store.get(stepsAtom)).toHaveLength(0)
  })
})
