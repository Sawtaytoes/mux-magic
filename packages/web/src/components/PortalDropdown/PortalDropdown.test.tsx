import {
  cleanup,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { useRef } from "react"
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"
import type { PortalDropdownItem } from "./PortalDropdown"
import { PortalDropdown } from "./PortalDropdown"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const THREE_ITEMS: PortalDropdownItem[] = [
  {
    key: "alpha",
    onSelect: () => {},
    content: <span>Alpha</span>,
  },
  {
    key: "beta",
    onSelect: () => {},
    content: <span>Beta</span>,
  },
  {
    key: "gamma",
    onSelect: () => {},
    content: <span>Gamma</span>,
  },
]

const TestDropdown = ({
  maxHeightPx,
  isOpen = true,
  items = THREE_ITEMS,
}: {
  maxHeightPx?: number
  isOpen?: boolean
  items?: PortalDropdownItem[]
}) => {
  const anchorRef = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button ref={anchorRef} type="button">
        Trigger
      </button>
      <PortalDropdown
        anchorRef={anchorRef}
        isOpen={isOpen}
        items={items}
        maxHeightPx={maxHeightPx}
      />
    </>
  )
}

const mockAnchorAt = ({
  top,
  bottom,
  viewportHeight,
}: {
  top: number
  bottom: number
  viewportHeight: number
}) => {
  vi.spyOn(
    HTMLElement.prototype,
    "getBoundingClientRect",
  ).mockReturnValue({
    top,
    bottom,
    left: 0,
    right: 200,
    width: 200,
    height: bottom - top,
    x: 0,
    y: top,
    toJSON: () => ({}),
  })
  Object.defineProperty(window, "innerHeight", {
    value: viewportHeight,
    configurable: true,
    writable: true,
  })
}

describe("PortalDropdown — maxHeightPx prop", () => {
  test("defaults to 400px max-height when maxHeightPx is omitted", async () => {
    mockAnchorAt({
      top: 100,
      bottom: 140,
      viewportHeight: 800,
    })
    render(<TestDropdown />)
    const listbox = await waitFor(() =>
      screen.getByRole("listbox"),
    )
    expect(listbox.style.maxHeight).toBe("400px")
  })

  test("clamps to the provided maxHeightPx when it fits in available space", async () => {
    mockAnchorAt({
      top: 100,
      bottom: 140,
      viewportHeight: 800,
    })
    render(<TestDropdown maxHeightPx={300} />)
    const listbox = await waitFor(() =>
      screen.getByRole("listbox"),
    )
    expect(listbox.style.maxHeight).toBe("300px")
  })

  test("clamps to available viewport space when maxHeightPx exceeds it", async () => {
    // viewport=250, anchor at top=50, bottom=90:
    //   spaceBelow = 250-90-4-8 = 148
    //   spaceAbove = 50-4-8 = 38 (< spaceBelow so no flip)
    //   maxHeight = min(400, 148) = 148
    mockAnchorAt({
      top: 50,
      bottom: 90,
      viewportHeight: 250,
    })
    render(<TestDropdown maxHeightPx={400} />)
    const listbox = await waitFor(() =>
      screen.getByRole("listbox"),
    )
    expect(listbox.style.maxHeight).toBe("148px")
  })

  test("renders all option items inside the listbox", async () => {
    mockAnchorAt({
      top: 100,
      bottom: 140,
      viewportHeight: 800,
    })
    render(<TestDropdown />)
    const listbox = await waitFor(() =>
      screen.getByRole("listbox"),
    )
    const options = listbox.querySelectorAll(
      "[role='option']",
    )
    expect(options).toHaveLength(THREE_ITEMS.length)
  })

  test("renders nothing when isOpen is false", () => {
    mockAnchorAt({
      top: 100,
      bottom: 140,
      viewportHeight: 800,
    })
    render(<TestDropdown isOpen={false} />)
    expect(screen.queryByRole("listbox")).toBeNull()
  })

  test("renders nothing when items array is empty", () => {
    mockAnchorAt({
      top: 100,
      bottom: 140,
      viewportHeight: 800,
    })
    render(<TestDropdown items={[]} />)
    expect(screen.queryByRole("listbox")).toBeNull()
  })
})
