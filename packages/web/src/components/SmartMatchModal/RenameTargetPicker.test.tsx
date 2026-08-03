import {
  cleanup,
  render,
  screen,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  afterEach,
  beforeEach,
  expect,
  test,
  vi,
} from "vitest"

import { RenameTargetPicker } from "./RenameTargetPicker"
import type { ScoredCandidate } from "./smartMatchTypes"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// The Combobox/Listbox portal to the body and position off the trigger's
// measured rect, so stub getBoundingClientRect + innerHeight the same way
// the SmartMatchModal badge-sync test does.
beforeEach(() => {
  vi.spyOn(
    HTMLElement.prototype,
    "getBoundingClientRect",
  ).mockReturnValue({
    top: 100,
    bottom: 140,
    left: 0,
    right: 200,
    width: 200,
    height: 40,
    x: 0,
    y: 100,
    toJSON: () => ({}),
  } as DOMRect)
  Object.defineProperty(window, "innerHeight", {
    value: 800,
    configurable: true,
    writable: true,
  })
})

const scored = (name: string): ScoredCandidate => ({
  candidate: { name, timecode: undefined },
  confidence: 0.7,
  durationScore: 1,
  filenameScore: 0,
})

// 8 candidates → above the SEARCHABLE_CANDIDATE_COUNT threshold, so the
// searchable Combobox renders (not the single-select Listbox).
const manyCandidates: ScoredCandidate[] = [
  "A Hero In Hollywood",
  "Bowling for Beaker",
  "Muppets In Jail",
  "The Strip Mall Awards",
  "Walter's Extended Nightmare",
  "Credit Card Club",
  "The Complete Muppet Telethon Opening and More",
  "Permits and Paperwork",
].map(scored)

const renderPicker = (candidates: ScoredCandidate[]) =>
  render(
    <RenameTargetPicker
      candidates={candidates}
      selectedName={candidates[0]?.candidate.name ?? ""}
      onSelect={() => {}}
      isDisabled={false}
      ariaLabel="Rename target for X"
    />,
  )

// The Combobox filter input — a role="combobox" inside the popup, distinct
// from the trigger button.
const getFilterInput = () => screen.getByRole("combobox")

test("shows a filter box (Combobox) and narrows the options as the user types when there are many candidates", async () => {
  const user = userEvent.setup()
  renderPicker(manyCandidates)

  await user.click(
    screen.getByRole("button", {
      name: "Rename target for X",
    }),
  )
  const listbox = screen.getByRole("listbox")
  // All eight candidates are listed before filtering.
  expect(
    within(listbox).getAllByRole("option"),
  ).toHaveLength(8)

  await user.type(getFilterInput(), "permits")

  const remaining = within(listbox).getAllByRole("option")
  expect(remaining).toHaveLength(1)
  expect(remaining[0]).toHaveTextContent(
    "Permits and Paperwork",
  )
})

test("shows an empty-state message (not a vanished dropdown) when nothing matches", async () => {
  const user = userEvent.setup()
  renderPicker(manyCandidates)

  await user.click(
    screen.getByRole("button", {
      name: "Rename target for X",
    }),
  )
  await user.type(getFilterInput(), "zzz-no-such-thing")

  expect(
    screen.getByText("No candidates match."),
  ).toBeInTheDocument()
  expect(
    within(screen.getByRole("listbox")).queryAllByRole(
      "option",
    ),
  ).toHaveLength(0)
})

test("does not render a filter box (renders a Listbox) for a short candidate list", async () => {
  const user = userEvent.setup()
  renderPicker([
    scored("Theatrical Cut"),
    scored("Image Gallery"),
  ])

  await user.click(
    screen.getByRole("button", {
      name: "Rename target for X",
    }),
  )
  // The single-select Listbox has no search input.
  expect(screen.queryByRole("combobox")).toBeNull()
  expect(
    within(screen.getByRole("listbox")).getAllByRole(
      "option",
    ),
  ).toHaveLength(2)
})

test("selecting a candidate reports it and closes the popup", async () => {
  const user = userEvent.setup()
  const onSelect = vi.fn()
  render(
    <RenameTargetPicker
      candidates={[
        scored("Theatrical Cut"),
        scored("Image Gallery"),
      ]}
      selectedName="Theatrical Cut"
      onSelect={onSelect}
      isDisabled={false}
      ariaLabel="Rename target for X"
    />,
  )

  await user.click(
    screen.getByRole("button", {
      name: "Rename target for X",
    }),
  )
  await user.click(
    screen.getByRole("option", { name: /Image Gallery/ }),
  )

  expect(onSelect).toHaveBeenCalledWith("Image Gallery")
  expect(screen.queryByRole("listbox")).toBeNull()
})
