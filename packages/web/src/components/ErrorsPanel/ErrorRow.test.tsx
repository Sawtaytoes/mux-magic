import {
  cleanup,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"
import { ErrorRow } from "./ErrorRow"
import type { PersistedJobError } from "./errorAtoms"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const makeRecord = (
  overrides: Partial<PersistedJobError> = {},
): PersistedJobError => ({
  id: "err_test1",
  jobId: "job_abc",
  level: "error",
  msg: "Something went wrong",
  occurredAt: "2026-05-15T12:00:00.000Z",
  webhookDelivery: {
    attempts: 0,
    state: "pending",
  },
  ...overrides,
})

const renderRow = ({
  record,
  onDismiss = vi.fn(),
  onRedeliver = vi.fn(),
}: {
  record: PersistedJobError
  onDismiss?: () => Promise<void>
  onRedeliver?: () => Promise<void>
}) => {
  render(
    <ErrorRow
      record={record}
      onDismiss={onDismiss}
      onRedeliver={onRedeliver}
    />,
  )
}

describe("ErrorRow — state badge", () => {
  test("shows pending badge for pending records", () => {
    renderRow({
      record: makeRecord({
        webhookDelivery: { attempts: 0, state: "pending" },
      }),
    })
    expect(screen.getByText("pending")).toBeVisible()
  })

  test("shows delivered badge for delivered records", () => {
    renderRow({
      record: makeRecord({
        webhookDelivery: {
          attempts: 1,
          state: "delivered",
        },
      }),
    })
    expect(screen.getByText("delivered")).toBeVisible()
  })

  test("shows exhausted badge for exhausted records", () => {
    renderRow({
      record: makeRecord({
        webhookDelivery: {
          attempts: 8,
          state: "exhausted",
        },
      }),
    })
    expect(screen.getByText("exhausted")).toBeVisible()
  })
})

describe("ErrorRow — row actions", () => {
  test("retry button is only visible for exhausted rows", () => {
    renderRow({
      record: makeRecord({
        webhookDelivery: {
          attempts: 8,
          state: "exhausted",
        },
      }),
    })
    expect(
      screen.getByRole("button", {
        name: /retry delivery/i,
      }),
    ).toBeVisible()
  })

  test("retry button is not shown for pending rows", () => {
    renderRow({
      record: makeRecord({
        webhookDelivery: { attempts: 0, state: "pending" },
      }),
    })
    expect(
      screen.queryByRole("button", {
        name: /retry delivery/i,
      }),
    ).toBeNull()
  })

  test("retry button is not shown for delivered rows", () => {
    renderRow({
      record: makeRecord({
        webhookDelivery: {
          attempts: 1,
          state: "delivered",
        },
      }),
    })
    expect(
      screen.queryByRole("button", {
        name: /retry delivery/i,
      }),
    ).toBeNull()
  })

  test("dismiss button is visible on every row", () => {
    renderRow({
      record: makeRecord({
        webhookDelivery: { attempts: 0, state: "pending" },
      }),
    })
    expect(
      screen.getByRole("button", { name: /dismiss/i }),
    ).toBeVisible()
  })

  test("dismiss button shows confirmation step before calling onDismiss", async () => {
    const onDismiss = vi.fn().mockResolvedValue(undefined)
    renderRow({ record: makeRecord(), onDismiss })

    await userEvent.click(
      screen.getByRole("button", { name: /dismiss/i }),
    )

    // First click should show a confirmation prompt, NOT call onDismiss yet
    expect(onDismiss).not.toHaveBeenCalled()
    expect(
      screen.getByRole("button", { name: /confirm/i }),
    ).toBeVisible()
  })

  test("confirm button calls onDismiss after confirmation", async () => {
    const onDismiss = vi.fn().mockResolvedValue(undefined)
    renderRow({ record: makeRecord(), onDismiss })

    await userEvent.click(
      screen.getByRole("button", { name: /dismiss/i }),
    )
    await userEvent.click(
      screen.getByRole("button", { name: /confirm/i }),
    )

    await waitFor(() => {
      expect(onDismiss).toHaveBeenCalledOnce()
    })
  })

  test("retry button calls onRedeliver immediately", async () => {
    const onRedeliver = vi.fn().mockResolvedValue(undefined)
    renderRow({
      record: makeRecord({
        webhookDelivery: {
          attempts: 8,
          state: "exhausted",
        },
      }),
      onRedeliver,
    })

    await userEvent.click(
      screen.getByRole("button", {
        name: /retry delivery/i,
      }),
    )

    await waitFor(() => {
      expect(onRedeliver).toHaveBeenCalledOnce()
    })
  })
})

describe("ErrorRow — content", () => {
  test("shows msg truncated in list row", () => {
    renderRow({
      record: makeRecord({ msg: "My error message" }),
    })
    expect(
      screen.getByText("My error message"),
    ).toBeVisible()
  })

  test("shows jobId in the row", () => {
    renderRow({
      record: makeRecord({ jobId: "job_abc123" }),
    })
    expect(screen.getByText(/job_abc123/)).toBeVisible()
  })

  test("detail expansion shows stack when present", async () => {
    renderRow({
      record: makeRecord({
        stack: "Error: boom\n  at foo.ts:1:2",
      }),
    })

    // Expand the detail
    await userEvent.click(
      screen.getByRole("button", { name: /expand/i }),
    )

    expect(screen.getByText(/at foo\.ts/)).toBeVisible()
  })
})
