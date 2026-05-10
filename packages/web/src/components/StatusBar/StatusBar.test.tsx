import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, it } from "vitest"
import type { ConnectionStatus } from "../../state/jobsConnectionAtom"
import { jobsConnectionAtom } from "../../state/jobsConnectionAtom"
import { StatusBar } from "./StatusBar"

afterEach(cleanup)

const renderBar = (status: ConnectionStatus) => {
  const store = createStore()
  store.set(jobsConnectionAtom, status)
  render(
    <Provider store={store}>
      <StatusBar />
    </Provider>,
  )
}

describe("StatusBar", () => {
  it("shows Connecting when status is connecting", () => {
    renderBar("connecting")
    expect(
      screen.getByText(/Connecting/),
    ).toBeInTheDocument()
  })

  it("shows Connected when status is connected", () => {
    renderBar("connected")
    expect(
      screen.getByText("Connected"),
    ).toBeInTheDocument()
  })

  it("shows unstable message when status is unstable", () => {
    renderBar("unstable")
    expect(screen.getByText(/unstable/)).toBeInTheDocument()
  })

  it("exposes data-status attribute for CSS targeting", () => {
    renderBar("connected")
    expect(
      screen.getByTestId("status-bar").dataset.status,
    ).toBe("connected")
  })
})
