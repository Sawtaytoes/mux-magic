import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createStore, Provider } from "jotai"
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"
import { stepsAtom } from "../../state/stepsAtom"
import type { Group, Step } from "../../types"
import { GroupCard } from "./GroupCard"

const makeStep = (id: string): Step => ({
  id,
  alias: "",
  command: "",
  params: {},
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
})

const makeGroup = (
  overrides: Partial<Group> = {},
): Group => ({
  kind: "group",
  id: "group_1",
  label: "My Group",
  isParallel: false,
  isCollapsed: false,
  steps: [makeStep("step_1"), makeStep("step_2")],
  ...overrides,
})

const renderCard = (
  group: Group,
  props: Partial<{
    isFirst: boolean
    isLast: boolean
  }> = {},
) => {
  const store = createStore()
  store.set(stepsAtom, [group])
  render(
    <Provider store={store}>
      <GroupCard
        group={group}
        itemIndex={0}
        startingFlatIndex={0}
        isFirst={props.isFirst ?? true}
        isLast={props.isLast ?? true}
      />
    </Provider>,
  )
  return store
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("GroupCard", () => {
  test("renders the group label", () => {
    renderCard(makeGroup({ label: "My Group" }))
    expect(
      screen.getByDisplayValue("My Group"),
    ).toBeInTheDocument()
  })

  test("shows sequential badge for non-parallel group", () => {
    renderCard(makeGroup({ isParallel: false }))
    expect(
      screen.getByText("sequential"),
    ).toBeInTheDocument()
  })

  test("shows parallel badge for parallel group", () => {
    renderCard(makeGroup({ isParallel: true }))
    expect(screen.getByText("parallel")).toBeInTheDocument()
  })

  test("renders inner step cards", () => {
    renderCard(makeGroup())
    // Both steps render index labels: 1 and 2
    const ones = screen.getAllByText("1")
    expect(ones.length).toBeGreaterThanOrEqual(1)
  })

  test("hides inner steps when collapsed", () => {
    const group = makeGroup({ isCollapsed: true })
    renderCard(group)
    // Inner step index "1" should not be visible
    expect(screen.queryAllByText("1")).toHaveLength(0)
  })

  test("toggles collapsed state on chevron click", async () => {
    const user = userEvent.setup()
    const store = renderCard(
      makeGroup({ isCollapsed: false }),
    )

    await user.click(screen.getByTitle(/collapse group/i))

    const items = store.get(stepsAtom)
    expect((items[0] as Group).isCollapsed).toBe(true)
  })

  test("removes group from atom when remove button clicked", async () => {
    vi.spyOn(
      document,
      "startViewTransition",
    ).mockImplementation((fn) => {
      ;(fn as () => void)?.()
      return undefined as unknown as ViewTransition
    })
    const user = userEvent.setup()
    const store = renderCard(makeGroup())

    await user.click(
      screen.getByTitle(/remove this group/i),
    )

    expect(store.get(stepsAtom)).toHaveLength(0)
  })

  test("adds a step to the group when '+ Step' is clicked", async () => {
    const user = userEvent.setup()
    const store = renderCard(makeGroup())

    await user.click(
      screen.getByTitle(/add a step inside this group/i),
    )

    const items = store.get(stepsAtom)
    expect((items[0] as Group).steps).toHaveLength(3)
  })

  test("B12: calls startViewTransition when ✕ delete button is clicked", async () => {
    const spy = vi
      .spyOn(document, "startViewTransition")
      .mockReturnValue(
        undefined as unknown as ViewTransition,
      )
    const user = userEvent.setup()
    renderCard(makeGroup())

    await user.click(
      screen.getByTitle(/remove this group/i),
    )

    expect(spy).toHaveBeenCalledOnce()
  })

  test("B12: calls startViewTransition when 📋 Paste button is clicked", async () => {
    const spy = vi
      .spyOn(document, "startViewTransition")
      .mockReturnValue(
        undefined as unknown as ViewTransition,
      )
    const user = userEvent.setup()
    renderCard(makeGroup())

    await user.click(
      screen.getByTitle(/paste a copied step/i),
    )

    expect(spy).toHaveBeenCalledOnce()
  })

  test("B1: calls startViewTransition when ↑ button is clicked", async () => {
    const spy = vi
      .spyOn(document, "startViewTransition")
      .mockReturnValue(
        undefined as unknown as ViewTransition,
      )
    const user = userEvent.setup()
    renderCard(makeGroup(), {
      isFirst: false,
      isLast: true,
    })

    await user.click(screen.getByTitle(/move group up/i))

    expect(spy).toHaveBeenCalledOnce()
  })

  test("B1: calls startViewTransition when ↓ button is clicked", async () => {
    const spy = vi
      .spyOn(document, "startViewTransition")
      .mockReturnValue(
        undefined as unknown as ViewTransition,
      )
    const user = userEvent.setup()
    renderCard(makeGroup(), {
      isFirst: true,
      isLast: false,
    })

    await user.click(screen.getByTitle(/move group down/i))

    expect(spy).toHaveBeenCalledOnce()
  })
})
