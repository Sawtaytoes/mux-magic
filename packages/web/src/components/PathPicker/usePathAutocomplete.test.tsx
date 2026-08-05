import {
  act,
  renderHook,
  waitFor,
} from "@testing-library/react"
import { useState } from "react"
import { afterEach, expect, test, vi } from "vitest"
import { usePathAutocomplete } from "./usePathAutocomplete"

// Mirrors `fetchDirEntries`, which calls `response.json()`.
const stubFetchResolving = (response: unknown) => {
  const fetchMock = vi.fn().mockResolvedValue({
    json: () => Promise.resolve(response),
  })

  vi.stubGlobal("fetch", fetchMock)

  return fetchMock
}

// A stand-in for the consumer: the field value lives in state and
// `onWriteValue` updates it, exactly as PathField/PathValueInput do.
const useHarness = () => {
  const [value, setValue] = useState("")

  const pathAutocomplete = usePathAutocomplete({
    onWriteValue: setValue,
    value,
  })

  return { pathAutocomplete, value }
}

afterEach(() => {
  vi.unstubAllGlobals()

  vi.restoreAllMocks()
})

test("filters to directories whose name prefixes the trailing segment", async () => {
  stubFetchResolving({
    entries: [
      { name: "Downloads", isDirectory: true },
      { name: "Desktop", isDirectory: true },
      { name: "notes.txt", isDirectory: false },
    ],
    separator: "/",
  })

  const { result } = renderHook(() => useHarness())

  act(() => {
    result.current.pathAutocomplete.onInputChange(
      "/home/De",
    )
  })

  await waitFor(() => {
    expect(
      result.current.pathAutocomplete.options.length,
    ).toBeGreaterThan(0)
  })

  // "notes.txt" is not a directory; "Downloads" does not start with "De".
  expect(
    result.current.pathAutocomplete.options.map(
      (option) => option.value,
    ),
  ).toEqual(["Desktop"])
})

test("does not open for a non-absolute value", () => {
  stubFetchResolving({ entries: [], separator: "/" })

  const { result } = renderHook(() => useHarness())

  act(() => {
    result.current.pathAutocomplete.onInputChange(
      "relative",
    )
  })

  expect(result.current.pathAutocomplete.isOpen).toBe(false)
})

test("reports loading while the directory fetch is in flight", async () => {
  // A fetch that never resolves keeps the loading state observable.
  vi.stubGlobal(
    "fetch",
    vi.fn().mockReturnValue(new Promise(() => {})),
  )

  const { result } = renderHook(() => useHarness())

  act(() => {
    result.current.pathAutocomplete.onInputChange("/var/")
  })

  await waitFor(() => {
    expect(result.current.pathAutocomplete.isLoading).toBe(
      true,
    )
  })
})

test("surfaces a rejected fetch as an error", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new Error("Network boom")),
  )

  const { result } = renderHook(() => useHarness())

  act(() => {
    result.current.pathAutocomplete.onInputChange("/var/")
  })

  await waitFor(() => {
    expect(result.current.pathAutocomplete.error).toBe(
      "Network boom",
    )
  })
})

test("selecting a folder drills in (appends + re-roots) and stays open", async () => {
  stubFetchResolving({
    entries: [{ name: "Music", isDirectory: true }],
    separator: "/",
  })

  const { result } = renderHook(() => useHarness())

  act(() => {
    result.current.pathAutocomplete.onInputChange("/home/")
  })

  await waitFor(() => {
    expect(
      result.current.pathAutocomplete.options.map(
        (option) => option.value,
      ),
    ).toEqual(["Music"])
  })

  act(() => {
    result.current.pathAutocomplete.onSelectFolder("Music")
  })

  // The value drilled in with a trailing separator, and it stayed open so
  // the next directory can be fetched.
  await waitFor(() => {
    expect(result.current.value).toBe("/home/Music/")
  })

  expect(result.current.pathAutocomplete.isOpen).toBe(true)
})
