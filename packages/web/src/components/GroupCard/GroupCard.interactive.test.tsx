import { cleanup, render } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, test } from "vitest"
import { FIXTURE_COMMANDS } from "../../commands/__fixtures__/commands"
import { commandsAtom } from "../../state/commandsAtom"
import { stepsAtom } from "../../state/stepsAtom"
import type { Group, Step } from "../../types"
import { GroupCard } from "./GroupCard"

afterEach(() => {
  cleanup()
})

const makeStep = (overrides: Partial<Step> = {}): Step => ({
  id: "step_1",
  alias: "Test Step",
  command: "keepLanguages",
  params: {
    sourcePath: "/mnt/input",
    audioLanguages: ["eng"],
  },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
  ...overrides,
})

const makeGroup = (
  overrides: Partial<Group> = {},
): Group => ({
  kind: "group",
  id: "group_1",
  label: "Test Group",
  isParallel: false,
  steps: [makeStep()],
  isCollapsed: false,
  ...overrides,
})

const renderWithAtoms = (
  group: Group,
  props: Partial<{
    isFirst: boolean
    isLast: boolean
    startingFlatIndex: number
  }> = {},
) => {
  const store = createStore()
  store.set(commandsAtom, FIXTURE_COMMANDS)
  store.set(stepsAtom, [group])
  const { container } = render(
    <Provider store={store}>
      <GroupCard
        group={group}
        itemIndex={0}
        isFirst={props.isFirst ?? true}
        isLast={props.isLast ?? true}
        startingFlatIndex={props.startingFlatIndex ?? 0}
      />
    </Provider>,
  )
  return { store, container }
}

describe("GroupCard interactive", () => {
  test("renders a parallel group with wired atoms", () => {
    const group = makeGroup({ isParallel: true })
    const { container } = renderWithAtoms(group)
    const groupCard = container.querySelector(
      "[data-group='group_1']",
    )
    expect(groupCard).toBeInTheDocument()
  })

  test("renders a sequential group", () => {
    const group = makeGroup({ isParallel: false })
    const { container } = renderWithAtoms(group)
    const groupCard = container.querySelector(
      "[data-group='group_1']",
    )
    expect(groupCard).toBeInTheDocument()
  })

  test("renders inner steps when group is expanded", () => {
    const group = makeGroup({
      steps: [
        makeStep({ id: "step_1", alias: "First Step" }),
        makeStep({ id: "step_2", alias: "Second Step" }),
      ],
    })
    const { container } = renderWithAtoms(group)
    expect(
      container.querySelector("[data-step-card='step_1']"),
    ).toBeInTheDocument()
    expect(
      container.querySelector("[data-step-card='step_2']"),
    ).toBeInTheDocument()
  })

  test("hides inner steps when group is collapsed", () => {
    const group = makeGroup({ isCollapsed: true })
    const { container } = renderWithAtoms(group)
    const groupCard = container.querySelector(
      "[data-group='group_1']",
    )
    expect(groupCard).toBeInTheDocument()
    expect(
      container.querySelector("[data-step-card='step_1']"),
    ).not.toBeInTheDocument()
  })
})
