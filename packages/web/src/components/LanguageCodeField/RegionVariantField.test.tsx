import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, test } from "vitest"
import { RegionVariantField } from "./RegionVariantField"

afterEach(() => {
  cleanup()
})

// The variant control is a `Picker` — a trigger button that opens a
// listbox — so its accessible name carries the current value:
// "Variant: (none)".
const getTrigger = () =>
  screen.getByRole("button", { name: /^Variant: / })

describe("RegionVariantField — no variants for jpn", () => {
  test("renders nothing when base code is jpn", () => {
    const { container } = render(
      <RegionVariantField
        baseCode="jpn"
        selectedIetf={null}
        onIetfChange={() => {}}
      />,
    )
    expect(container.firstChild).toBeNull()
  })
})

describe("RegionVariantField — variants for chi", () => {
  test("renders a picker when base code is chi", () => {
    render(
      <RegionVariantField
        baseCode="chi"
        selectedIetf={null}
        onIetfChange={() => {}}
      />,
    )
    expect(getTrigger()).toBeVisible()
  })

  test("has (none) as the first option", async () => {
    const user = userEvent.setup()
    render(
      <RegionVariantField
        baseCode="chi"
        selectedIetf={null}
        onIetfChange={() => {}}
      />,
    )
    await user.click(getTrigger())
    const options = screen.getAllByRole("option")
    expect(options[0]).toHaveTextContent("(none)")
  })

  test("has 7 entries for chi: (none) + 7 variants = 8 options", async () => {
    const user = userEvent.setup()
    render(
      <RegionVariantField
        baseCode="chi"
        selectedIetf={null}
        onIetfChange={() => {}}
      />,
    )
    await user.click(getTrigger())
    const options = screen.getAllByRole("option")
    expect(options).toHaveLength(8)
  })

  test("option text includes both name and tag", async () => {
    const user = userEvent.setup()
    render(
      <RegionVariantField
        baseCode="chi"
        selectedIetf={null}
        onIetfChange={() => {}}
      />,
    )
    await user.click(getTrigger())
    expect(
      screen.getByRole("option", {
        name: "Traditional — Hong Kong (zh-Hant-HK)",
      }),
    ).toBeVisible()
  })

  test("shows the currently selected ietf tag", () => {
    render(
      <RegionVariantField
        baseCode="chi"
        selectedIetf="zh-Hant-HK"
        onIetfChange={() => {}}
      />,
    )
    expect(getTrigger()).toHaveAccessibleName(
      "Variant: Traditional — Hong Kong (zh-Hant-HK)",
    )
  })

  test("calls onIetfChange with the new tag when changed", async () => {
    const user = userEvent.setup()
    const changes: Array<string | null> = []
    render(
      <RegionVariantField
        baseCode="chi"
        selectedIetf={null}
        onIetfChange={(tag) => {
          changes.push(tag)
        }}
      />,
    )

    await user.click(getTrigger())
    await user.click(
      screen.getByRole("option", {
        name: "Traditional — Hong Kong (zh-Hant-HK)",
      }),
    )

    expect(changes).toEqual(["zh-Hant-HK"])
  })

  test("calls onIetfChange with null when (none) is selected", async () => {
    const user = userEvent.setup()
    const changes: Array<string | null> = []
    render(
      <RegionVariantField
        baseCode="chi"
        selectedIetf="zh-Hant-HK"
        onIetfChange={(tag) => {
          changes.push(tag)
        }}
      />,
    )

    await user.click(getTrigger())
    await user.click(
      screen.getByRole("option", { name: "(none)" }),
    )

    expect(changes).toEqual([null])
  })

  test("arrow keys and Enter pick an option from the keyboard", async () => {
    const user = userEvent.setup()
    const changes: Array<string | null> = []
    render(
      <RegionVariantField
        baseCode="chi"
        selectedIetf={null}
        onIetfChange={(tag) => {
          changes.push(tag)
        }}
      />,
    )

    await user.click(getTrigger())
    await user.keyboard("{ArrowDown}{Enter}")

    expect(changes).toEqual(["zh-Hans"])
  })
})

describe("RegionVariantField — variants for por", () => {
  test("renders a picker with 2 variants + (none) = 3 options", async () => {
    const user = userEvent.setup()
    render(
      <RegionVariantField
        baseCode="por"
        selectedIetf={null}
        onIetfChange={() => {}}
      />,
    )
    await user.click(getTrigger())
    const options = screen.getAllByRole("option")
    expect(options).toHaveLength(3)
  })
})
