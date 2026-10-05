import { reportProviderCacheFallback } from "@mux-magic/core/src/provider-cache/providerCacheFallbacks.js"
import { searchMal } from "@mux-magic/core/src/tools/searchMal.js"
import { from } from "rxjs"
import { afterEach, expect, test, vi } from "vitest"
import type { SearchMalResponse } from "../types.js"
import { queryRoutes } from "./queryRoutes.js"

vi.mock("@mux-magic/core/src/tools/searchMal.js", () => ({
  searchMal: vi.fn(),
}))
vi.mock("@mux-magic/tools", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@mux-magic/tools")
  >()),
  logWarning: vi.fn(),
  logError: vi.fn(),
}))

afterEach(() => vi.clearAllMocks())

const buildFallback = (request: string) => ({
  ageMilliseconds: 172800000,
  cachedAt: "2026-09-27T12:00:00.000Z",
  cause: "Provider unavailable",
  isProviderSkipped: false,
  provider: "jikan",
  request,
})

const search = (searchTerm: string) =>
  queryRoutes.request("/queries/searchMal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ searchTerm }),
  })

test("returns only this lookup's fallbacks across overlapping requests", async () => {
  const firstStarted = Promise.withResolvers<void>()
  const secondStarted = Promise.withResolvers<void>()
  const releaseFirst = Promise.withResolvers<void>()
  const releaseSecond = Promise.withResolvers<void>()
  vi.mocked(searchMal).mockImplementation((searchTerm) =>
    from(
      (async () => {
        const isFirst = searchTerm === "First"
        ;(isFirst ? firstStarted : secondStarted).resolve()
        await (isFirst ? releaseFirst : releaseSecond)
          .promise
        reportProviderCacheFallback(
          buildFallback(searchTerm),
        )
        return [
          { malId: isFirst ? 1 : 2, name: searchTerm },
        ]
      })(),
    ),
  )
  const firstResponse = search("First")
  await firstStarted.promise
  const secondResponse = search("Second")
  await secondStarted.promise
  // A background job or unrelated lookup is outside both collectors.
  reportProviderCacheFallback(buildFallback("Unrelated"))
  releaseSecond.resolve()
  const secondBody = (await (
    await secondResponse
  ).json()) as SearchMalResponse
  releaseFirst.resolve()
  const firstBody = (await (
    await firstResponse
  ).json()) as SearchMalResponse
  expect(firstBody.providerCacheFallbacks).toEqual([
    buildFallback("First"),
  ])
  expect(secondBody.providerCacheFallbacks).toEqual([
    buildFallback("Second"),
  ])
  expect(firstBody.results).toEqual([
    { malId: 1, name: "First" },
  ])
})

test("a fresh retry returns an empty fallback list", async () => {
  vi.mocked(searchMal).mockImplementation(() =>
    from(Promise.resolve([{ malId: 1, name: "Fresh" }])),
  )
  const response = await search("Fresh")
  expect(await response.json()).toEqual({
    results: [{ malId: 1, name: "Fresh" }],
    error: null,
    providerCacheFallbacks: [],
  })
})

test("preserves fallback reports when subsequent processing fails", async () => {
  vi.mocked(searchMal).mockImplementation(() =>
    from(
      Promise.resolve().then(() => {
        reportProviderCacheFallback(buildFallback("Broken"))
        throw new Error("Cannot parse result")
      }),
    ),
  )
  const response = await search("Broken")
  expect(await response.json()).toEqual({
    results: [],
    error: "Cannot parse result",
    providerCacheFallbacks: [buildFallback("Broken")],
  })
})
