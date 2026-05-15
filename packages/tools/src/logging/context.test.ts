import { describe, expect, test } from "vitest"

import {
  getLoggingContext,
  loggingContext,
  withLoggingContext,
} from "./context.js"

describe(withLoggingContext.name, () => {
  test("seeds the context for the duration of fn", () => {
    const seen = withLoggingContext({ jobId: "j1" }, () =>
      getLoggingContext(),
    )

    expect(seen).toEqual({ jobId: "j1" })
  })

  test("returns an empty context outside any run", () => {
    expect(getLoggingContext()).toEqual({})
  })

  test("nested call merges parent bindings under the child", () => {
    const seen = withLoggingContext(
      { jobId: "j1", stepIndex: 0 },
      () =>
        withLoggingContext(
          { stepIndex: 2, fileId: "f" },
          () => getLoggingContext(),
        ),
    )

    expect(seen).toEqual({
      jobId: "j1",
      stepIndex: 2,
      fileId: "f",
    })
  })

  test("propagates through awaited promises", async () => {
    const seen = await withLoggingContext(
      { jobId: "j-async" },
      async () => {
        await Promise.resolve()
        await new Promise((resolve) =>
          setTimeout(resolve, 0),
        )
        return getLoggingContext()
      },
    )

    expect(seen.jobId).toBe("j-async")
  })

  test("`loggingContext` is a single AsyncLocalStorage instance", () => {
    expect(loggingContext.getStore).toBeTypeOf("function")
  })
})
