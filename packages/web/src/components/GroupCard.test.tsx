import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createStore, Provider } from "jotai"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import { stepsAtom } from "../state/stepsAtom"
import type { Group, Step } from "../types"
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

beforeEach(() => {
  window.mediaTools = { COMMANDS: {}, renderAll: vi.fn() }
  window.commandLabel = (name: string) => name
  window.commandPicker = { open: vi.fn(), close: vi.fn() }
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("GroupCard", () => {
  it("renders the group label", () => {
    renderCard(makeGroup({ label: "My Group" }))
    expect(
      screen.getByDisplayValue("My Group"),
    ).toBeInTheDocument()
  })

  it("shows sequential badge for non-parallel group", () => {
    renderCard(makeGroup({ isParallel: false }))
    expect(
      screen.getByText("sequential"),
    ).toBeInTheDocument()
  })

  it("shows parallel badge for parallel group", () => {
    renderCard(makeGroup({ isParallel: true }))
    expect(screen.getByText("parallel")).toBeInTheDocument()
  })

  it("renders inner step cards", () => {
    renderCard(makeGroup())
    // Both steps render index labels: 1 and 2
    const ones = screen.getAllByText("1")
    expect(ones.length).toBeGreaterThanOrEqual(1)
  })

  it("hides inner steps when collapsed", () => {
    const group = makeGroup({ isCollapsed: true })
    renderCard(group)
    // Inner step index "1" should not be visible
    expect(screen.queryAllByText("1")).toHaveLength(0)
  })

  it("toggles collapsed state on chevron click", async () => {
    const user = userEvent.setup()
    const store = renderCard(
      makeGroup({ isCollapsed: false }),
    )

    await user.click(screen.getByTitle(/collapse group/i))

    const items = store.get(stepsAtom)
    expect((items[0] as Group).isCollapsed).toBe(true)
  })

  it("removes group from atom when remove button clicked", async () => {
    const user = userEvent.setup()
    const store = renderCard(makeGroup())

    await user.click(
      screen.getByTitle(/remove this group/i),
    )

    expect(store.get(stepsAtom)).toHaveLength(0)
  })

  it("adds a step to the group when '+ Step' is clicked", async () => {
    const user = userEvent.setup()
    const store = renderCard(makeGroup())

    await user.click(
      screen.getByTitle(/add a step inside this group/i),
    )

    const items = store.get(stepsAtom)
    expect((items[0] as Group).steps).toHaveLength(3)
  })
})
