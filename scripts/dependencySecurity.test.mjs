import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { test } from "node:test"

const require = createRequire(
  new URL("../package.json", import.meta.url),
)
const braces = require("braces")
const CachePolicy = require("http-cache-semantics")
const request = {
  url: "https://example.invalid/resource",
  headers: {},
}
const staleRequest = {
  ...request,
  headers: { "cache-control": "max-stale=100000" },
}

test("nested braces and parentheses are rejected before recursive walkers", () => {
  ;[
    ["{", "}"],
    ["(", ")"],
  ].forEach(([open, close]) => {
    const attack = `${open.repeat(4000)}a${close.repeat(4000)}`
    ;[
      braces,
      braces.parse,
      braces.compile,
      braces.expand,
      braces.stringify,
    ].forEach((operation) => {
      assert.throws(() => operation(attack), {
        name: "SyntaxError",
        message:
          "Input nesting depth exceeds maximum (100)",
      })
    })
  })
})

test("normal globs and literal braces retain their behavior", () => {
  assert.deepEqual(braces.expand("src/{a,b}.{js,ts}"), [
    "src/a.js",
    "src/a.ts",
    "src/b.js",
    "src/b.ts",
  ])
  assert.doesNotThrow(() =>
    braces.compile(`${"{".repeat(100)}a${"}".repeat(100)}`),
  )
  assert.doesNotThrow(() =>
    braces.compile("\\{".repeat(1000)),
  )
})

;[
  {
    "cache-control": "max-age=3600",
    "set-cookie": "session=fixture",
  },
  { "cache-control": "max-age=1, proxy-revalidate" },
  { "cache-control": "no-cache" },
].forEach((headers) => {
  test(`max-stale cannot bypass cache restrictions: ${JSON.stringify(headers)}`, () => {
    const policy = new CachePolicy(request, {
      status: 200,
      headers,
    })
    const now = policy.now()
    policy.now = () => now + 7200000
    assert.equal(
      policy.satisfiesWithoutRevalidation(staleRequest),
      false,
    )
  })
})

test("ordinary expired cache entries still support max-stale", () => {
  const policy = new CachePolicy(request, {
    status: 200,
    headers: { "cache-control": "max-age=1" },
  })
  const now = policy.now()
  policy.now = () => now + 2000
  assert.equal(
    policy.satisfiesWithoutRevalidation(staleRequest),
    true,
  )
})

test("tagging library retains CommonJS UUID generation with the security override", () => {
  const taggingRequire = createRequire(
    require.resolve("node-taglib-sharp"),
  )
  const uuid = taggingRequire("uuid")
  assert.equal(uuid.validate(uuid.v4()), true)
  assert.throws(
    () =>
      uuid.v5("fixture", uuid.v5.DNS, new Uint8Array(1)),
    RangeError,
  )
  assert.equal(
    typeof require("node-taglib-sharp").File,
    "function",
  )
})
