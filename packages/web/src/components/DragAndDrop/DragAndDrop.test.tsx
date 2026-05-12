import { cleanup, render } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"
import { stepsAtom } from "../../state/stepsAtom"
import type { Step } from "../../types"
import { useDragAndDrop } from "./DragAndDrop"

// Mock sortablejs so tests don't depend on DOM drag event plumbing.
vi.mock("sortablejs", () => {
  const destroyFn = vi.fn()
  const getMock = vi.fn().mockReturnValue(undefined)
  const Constructor = vi.fn(() => ({
    destroy: destroyFn,
  })) as unknown as {
    new (
      el: HTMLElement,
      options: object,
    ): { destroy: () => void }
    get: typeof getMock
    mock: { instances: Array<{ destroy: () => void }> }
  }
  Constructor.get = getMock
  return { default: Constructor }
})

const step: Step = {
  id: "step_1",
  alias: "",
  command: "encode",
  params: {},
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

const TestHarness = ({
  containerRef,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>
}) => {
  useDragAndDrop(containerRef)
  return null
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("useDragAndDrop", () => {
  test("does not throw when containerRef is null", () => {
    const store = createStore()
    store.set(stepsAtom, [step])

    const containerRef = {
      current: null,
    } as React.RefObject<HTMLDivElement | null>

    expect(() =>
      render(
        <Provider store={store}>
          <TestHarness containerRef={containerRef} />
        </Provider>,
      ),
    ).not.toThrow()
  })

  test("renders without error when steps array changes", () => {
    const store = createStore()
    store.set(stepsAtom, [step])

    const containerRef = {
      current: null,
    } as React.RefObject<HTMLDivElement | null>

    const { rerender } = render(
      <Provider store={store}>
        <TestHarness containerRef={containerRef} />
      </Provider>,
    )

    store.set(stepsAtom, [])

    expect(() =>
      rerender(
        <Provider store={store}>
          <TestHarness containerRef={containerRef} />
        </Provider>,
      ),
    ).not.toThrow()
  })
})
