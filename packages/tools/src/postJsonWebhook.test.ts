import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import {
  postJsonWebhook,
  webhookTimeoutMilliseconds,
} from "./postJsonWebhook.js"

const webhookUrl =
  "http://receiver.invalid/api/webhook/example"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe(postJsonWebhook.name, () => {
  test("POSTs the body as JSON before it returns", () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(null, { status: 200 })),
    )
    vi.stubGlobal("fetch", fetchMock)

    void postJsonWebhook({
      body: { jobId: "job-1" },
      url: webhookUrl,
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith(
      webhookUrl,
      expect.objectContaining({
        body: JSON.stringify({ jobId: "job-1" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
    )
  })

  test("bounds the POST with the default timeout signal", () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout")
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(null, { status: 200 })),
    )
    vi.stubGlobal("fetch", fetchMock)

    void postJsonWebhook({ body: {}, url: webhookUrl })

    expect(timeoutSpy).toHaveBeenCalledWith(
      webhookTimeoutMilliseconds,
    )
    expect(
      (
        fetchMock.mock.calls[0] as unknown as [
          string,
          RequestInit,
        ]
      )[1].signal,
    ).toBe(timeoutSpy.mock.results[0]?.value)
  })

  test("uses a caller's own timeout", () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout")
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(null, { status: 200 }),
        ),
      ),
    )

    void postJsonWebhook({
      body: {},
      timeoutMilliseconds: 5000,
      url: webhookUrl,
    })

    expect(timeoutSpy).toHaveBeenCalledWith(5000)
  })

  test("reports a 2xx answer as delivered", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(null, { status: 204 }),
        ),
      ),
    )

    await expect(
      postJsonWebhook({ body: {}, url: webhookUrl }),
    ).resolves.toEqual({
      outcome: "delivered",
      status: 204,
    })
  })

  test("reports any other status as rejected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(null, { status: 404 }),
        ),
      ),
    )

    await expect(
      postJsonWebhook({ body: {}, url: webhookUrl }),
    ).resolves.toEqual({ outcome: "rejected", status: 404 })
  })

  test("resolves, never rejects, when the delivery times out", async () => {
    const timeoutController = new AbortController()
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(
      timeoutController.signal,
    )
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, options: RequestInit) =>
          new Promise((_resolve, reject) => {
            options.signal?.addEventListener(
              "abort",
              () => {
                reject(options.signal?.reason)
              },
            )
          }),
      ),
    )

    const delivery = postJsonWebhook({
      body: {},
      url: webhookUrl,
    })
    const timeoutError = new DOMException(
      "The operation was aborted due to timeout",
      "TimeoutError",
    )
    timeoutController.abort(timeoutError)

    await expect(delivery).resolves.toEqual({
      error: timeoutError,
      outcome: "failed",
    })
  })

  test("resolves, never throws, when fetch throws synchronously", async () => {
    const synchronousError = new Error("immediately broken")
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        throw synchronousError
      }),
    )

    await expect(
      postJsonWebhook({ body: {}, url: webhookUrl }),
    ).resolves.toEqual({
      error: synchronousError,
      outcome: "failed",
    })
  })

  test("resolves as failed when the body will not serialize", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      postJsonWebhook({
        body: { count: 1n },
        url: webhookUrl,
      }),
    ).resolves.toMatchObject({ outcome: "failed" })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
