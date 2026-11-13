import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import {
  defaultSseKeepaliveIntervalMilliseconds,
  type SseKeepaliveStream,
  startSseKeepalive,
} from "./startSseKeepalive.js"

const createStream = (
  overrides: Partial<SseKeepaliveStream> = {},
) => ({
  aborted: false,
  closed: false,
  write: vi.fn(() => Promise.resolve()),
  ...overrides,
})

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe(startSseKeepalive.name, () => {
  test("writes an SSE comment once per default interval", async () => {
    const stream = createStream()

    startSseKeepalive({ stream })
    await vi.advanceTimersByTimeAsync(
      defaultSseKeepaliveIntervalMilliseconds * 2,
    )

    expect(stream.write).toHaveBeenCalledTimes(2)
    expect(stream.write).toHaveBeenCalledWith(
      ": keepalive\n\n",
    )
  })

  test("uses a caller's own interval", async () => {
    const stream = createStream()

    startSseKeepalive({
      intervalMilliseconds: 1000,
      stream,
    })
    await vi.advanceTimersByTimeAsync(3000)

    expect(stream.write).toHaveBeenCalledTimes(3)
  })

  test("stops writing once the cleanup function runs", () => {
    const stream = createStream()

    const stopKeepalive = startSseKeepalive({
      intervalMilliseconds: 1000,
      stream,
    })
    stopKeepalive()
    vi.advanceTimersByTime(5000)

    expect(stream.write).not.toHaveBeenCalled()
  })

  test("stops on its own when the stream has closed", () => {
    const stream = createStream({ closed: true })

    startSseKeepalive({
      intervalMilliseconds: 1000,
      stream,
    })
    vi.advanceTimersByTime(5000)

    expect(stream.write).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  test("drops ticks while a write has not settled", async () => {
    const stream = createStream({
      write: vi.fn(
        () => new Promise<void>(() => undefined),
      ),
    })

    startSseKeepalive({
      intervalMilliseconds: 1000,
      stream,
    })
    await vi.advanceTimersByTimeAsync(5000)

    expect(stream.write).toHaveBeenCalledOnce()
  })

  test("stops on its own after a failed write", async () => {
    const stream = createStream({
      write: vi.fn(() => Promise.reject(new Error("gone"))),
    })

    startSseKeepalive({
      intervalMilliseconds: 1000,
      stream,
    })
    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(5000)

    expect(stream.write).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })
})
