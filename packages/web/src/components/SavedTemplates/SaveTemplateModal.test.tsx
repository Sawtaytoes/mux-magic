import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import { SaveTemplateModal } from "./SaveTemplateModal"

const SAMPLE_YAML = "steps: []\n"

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  cleanup()
})

const okJson = (data: unknown) =>
  Promise.resolve(
    new Response(JSON.stringify(data), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    }),
  )

describe("SaveTemplateModal", () => {
  test("returns null when not open", () => {
    const { container } = render(
      <SaveTemplateModal
        isOpen={false}
        yaml={SAMPLE_YAML}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  test("submits name + description; calls onSaved + onClose on success", async () => {
    const created = {
      id: "movie-workflow",
      name: "Movie Workflow",
      description: "desc",
      yaml: SAMPLE_YAML,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }
    fetchMock.mockReturnValueOnce(okJson(created))
    const onClose = vi.fn()
    const onSaved = vi.fn()
    render(
      <SaveTemplateModal
        isOpen={true}
        yaml={SAMPLE_YAML}
        onClose={onClose}
        onSaved={onSaved}
      />,
    )

    fireEvent.change(
      screen.getByPlaceholderText("My workflow"),
      { target: { value: "Movie Workflow" } },
    )
    fireEvent.change(
      screen.getByPlaceholderText(
        "What this template is for",
      ),
      { target: { value: "desc" } },
    )
    fireEvent.click(
      screen.getByRole("button", { name: "Save" }),
    )

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(created)
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ]
    expect(init.method).toBe("POST")
    const body = JSON.parse(init.body as string) as Record<
      string,
      unknown
    >
    expect(body).toEqual({
      name: "Movie Workflow",
      description: "desc",
      yaml: SAMPLE_YAML,
    })
  })

  test("shows the server error message and keeps form open on failure", async () => {
    fetchMock.mockReturnValueOnce(
      Promise.resolve(
        new Response(
          '{"error":"invalid yaml","details":"oops"}',
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    )
    const onClose = vi.fn()
    const onSaved = vi.fn()
    render(
      <SaveTemplateModal
        isOpen={true}
        yaml="bad"
        onClose={onClose}
        onSaved={onSaved}
      />,
    )

    fireEvent.change(
      screen.getByPlaceholderText("My workflow"),
      { target: { value: "X" } },
    )
    fireEvent.click(
      screen.getByRole("button", { name: "Save" }),
    )

    await screen.findByRole("alert")
    expect(onSaved).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  test("requires a non-empty name (inline validation, no fetch)", () => {
    render(
      <SaveTemplateModal
        isOpen={true}
        yaml={SAMPLE_YAML}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    )
    fireEvent.click(
      screen.getByRole("button", { name: "Save" }),
    )
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByRole("alert").textContent).toContain(
      "Name is required",
    )
  })
})
