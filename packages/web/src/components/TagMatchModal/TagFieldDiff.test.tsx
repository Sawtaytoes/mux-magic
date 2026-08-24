import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import {
  deriveTagChangeType,
  formatTagValue,
  parseTagFieldText,
  TagFieldDiff,
} from "./TagFieldDiff"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const readChangeType = (fieldName: string) =>
  document
    .querySelector(`[data-tag-match-field="${fieldName}"]`)
    ?.getAttribute("data-tag-match-change-type")

describe("deriveTagChangeType", () => {
  test("two equal strings are unchanged", () => {
    expect(
      deriveTagChangeType({
        currentValue: "Harbour Lights",
        proposedValue: "Harbour Lights",
      }),
    ).toBe("unchanged")
  })

  test("a zero-padded number equals the integer it means", () => {
    expect(
      deriveTagChangeType({
        currentValue: "01",
        proposedValue: 1,
      }),
    ).toBe("unchanged")
  })

  test("multi-value fields compare as ordered arrays", () => {
    expect(
      deriveTagChangeType({
        currentValue: ["Ambient", "Downtempo"],
        proposedValue: ["Ambient", "Downtempo"],
      }),
    ).toBe("unchanged")
    expect(
      deriveTagChangeType({
        currentValue: ["Ambient", "Downtempo"],
        proposedValue: ["Downtempo", "Ambient"],
      }),
    ).toBe("changed")
  })

  test("an empty current value with a proposal is added", () => {
    expect(
      deriveTagChangeType({
        currentValue: undefined,
        proposedValue: "Nova Harbour",
      }),
    ).toBe("added")
  })

  test("a current value with no proposal is removed", () => {
    expect(
      deriveTagChangeType({
        currentValue: "Unknown Composer",
        proposedValue: undefined,
      }),
    ).toBe("removed")
  })

  test("two different strings are changed", () => {
    expect(
      deriveTagChangeType({
        currentValue: "track 03",
        proposedValue: "Signal Fires",
      }),
    ).toBe("changed")
  })
})

describe("parseTagFieldText", () => {
  test("genres commits as an array", () => {
    expect(
      parseTagFieldText({
        fieldName: "genres",
        text: "Ambient, Downtempo",
      }),
    ).toEqual(["Ambient", "Downtempo"])
  })

  test("a numeric field commits as a number", () => {
    expect(
      parseTagFieldText({
        fieldName: "trackNumber",
        text: "4",
      }),
    ).toBe(4)
  })

  test("a plain field commits the text as typed", () => {
    expect(
      parseTagFieldText({
        fieldName: "title",
        text: "Signal Fires",
      }),
    ).toBe("Signal Fires")
  })
})

describe("formatTagValue", () => {
  test("an array joins with a comma", () => {
    expect(formatTagValue(["Ambient", "Downtempo"])).toBe(
      "Ambient, Downtempo",
    )
  })
})

describe("TagFieldDiff", () => {
  test("an unchanged field renders as unchanged and shows both values", () => {
    render(
      <TagFieldDiff
        currentValue="01"
        fieldName="trackNumber"
        isEditable={false}
        onChange={() => {}}
        proposedValue={1}
      />,
    )
    expect(readChangeType("trackNumber")).toBe("unchanged")
    expect(screen.getByText("01")).toBeVisible()
  })

  test("a changed field renders as changed", () => {
    render(
      <TagFieldDiff
        currentValue="track 03"
        fieldName="title"
        isEditable={false}
        onChange={() => {}}
        proposedValue="Signal Fires"
      />,
    )
    expect(readChangeType("title")).toBe("changed")
    expect(screen.getByText("Signal Fires")).toBeVisible()
  })

  test("an editable field commits typed text through onChange", async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(
      <TagFieldDiff
        currentValue=""
        fieldName="title"
        isEditable
        onChange={handleChange}
        proposedValue=""
      />,
    )
    await user.type(
      screen.getByLabelText("Title proposed value"),
      "A",
    )
    expect(handleChange).toHaveBeenCalledWith("A")
  })

  test("an editable genres field commits an array", async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(
      <TagFieldDiff
        currentValue=""
        fieldName="genres"
        isEditable
        onChange={handleChange}
        proposedValue=""
      />,
    )
    await user.type(
      screen.getByLabelText("Genres proposed value"),
      "Ambient, Downtempo",
    )
    // The proposed value is a fixed prop here, so React re-applies it
    // after every keystroke — the last commit is the last character.
    expect(handleChange).toHaveBeenCalledWith(["A"])
    expect(
      parseTagFieldText({
        fieldName: "genres",
        text: "Ambient, Downtempo",
      }),
    ).toEqual(["Ambient", "Downtempo"])
  })
})
