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
  test("renders a select when base code is chi", () => {
    render(
      <RegionVariantField
        baseCode="chi"
        selectedIetf={null}
        onIetfChange={() => {}}
      />,
    )
    expect(
      screen.getByRole("combobox"),
    ).toBeInTheDocument()
  })

  test("has (none) as the first option", () => {
    render(
      <RegionVariantField
        baseCode="chi"
        selectedIetf={null}
        onIetfChange={() => {}}
      />,
    )
    const options = screen.getAllByRole("option")
    expect(options[0]).toHaveValue("")
    expect(options[0]).toHaveTextContent("(none)")
  })

  test("has 7 entries for chi: (none) + 7 variants = 8 options", () => {
    render(
      <RegionVariantField
        baseCode="chi"
        selectedIetf={null}
        onIetfChange={() => {}}
      />,
    )
    const options = screen.getAllByRole("option")
    expect(options).toHaveLength(8)
  })

  test("option text includes both name and tag", () => {
    render(
      <RegionVariantField
        baseCode="chi"
        selectedIetf={null}
        onIetfChange={() => {}}
      />,
    )
    expect(
      screen.getByText(
        /Traditional — Hong Kong \(zh-Hant-HK\)/,
      ),
    ).toBeInTheDocument()
  })

  test("shows the currently selected ietf tag", () => {
    render(
      <RegionVariantField
        baseCode="chi"
        selectedIetf="zh-Hant-HK"
        onIetfChange={() => {}}
      />,
    )
    const select = screen.getByRole("combobox")
    expect(select).toHaveValue("zh-Hant-HK")
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

    await user.selectOptions(
      screen.getByRole("combobox"),
      "zh-Hant-HK",
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

    await user.selectOptions(
      screen.getByRole("combobox"),
      "",
    )

    expect(changes).toEqual([null])
  })
})

describe("RegionVariantField — variants for por", () => {
  test("renders a select with 2 variants + (none) = 3 options", () => {
    render(
      <RegionVariantField
        baseCode="por"
        selectedIetf={null}
        onIetfChange={() => {}}
      />,
    )
    const options = screen.getAllByRole("option")
    expect(options).toHaveLength(3)
  })
})
