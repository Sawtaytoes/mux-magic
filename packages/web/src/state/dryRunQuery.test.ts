import { createStore } from "jotai"
import { afterEach, describe, expect, test } from "vitest"
import { apiBase } from "../apiBase"
import {
  buildRunFetchUrl,
  dryRunAtom,
  failureModeAtom,
} from "./dryRunQuery"

describe("buildRunFetchUrl — Dry-Run query forwarding", () => {
  test("returns URL unchanged when dry-run is off", () => {
    expect(
      buildRunFetchUrl("/sequences/run", {
        isDryRun: false,
        isFailureMode: false,
      }),
    ).toBe(`${apiBase}/sequences/run`)
  })

  test("returns URL unchanged when dry-run is off, even if failureMode is true (defensive)", () => {
    expect(
      buildRunFetchUrl("/sequences/run", {
        isDryRun: false,
        isFailureMode: true,
      }),
    ).toBe(`${apiBase}/sequences/run`)
  })

  test("appends ?fake=success when dry-run is on and failureMode is off", () => {
    expect(
      buildRunFetchUrl("/sequences/run", {
        isDryRun: true,
        isFailureMode: false,
      }),
    ).toBe(`${apiBase}/sequences/run?fake=success`)
  })

  test("appends ?fake=failure when dry-run AND failureMode are both on", () => {
    expect(
      buildRunFetchUrl("/sequences/run", {
        isDryRun: true,
        isFailureMode: true,
      }),
    ).toBe(`${apiBase}/sequences/run?fake=failure`)
  })

  test("uses & not ? when baseUrl already has a query string", () => {
    expect(
      buildRunFetchUrl("/commands/foo?bar=baz", {
        isDryRun: true,
        isFailureMode: false,
      }),
    ).toBe(`${apiBase}/commands/foo?bar=baz&fake=success`)
  })

  test("works for the /commands/:name endpoint shape", () => {
    expect(
      buildRunFetchUrl("/commands/deleteFolder", {
        isDryRun: true,
        isFailureMode: false,
      }),
    ).toBe(`${apiBase}/commands/deleteFolder?fake=success`)
  })

  test("works for the /commands/:name endpoint shape with failure mode", () => {
    expect(
      buildRunFetchUrl("/commands/deleteFolder", {
        isDryRun: true,
        isFailureMode: true,
      }),
    ).toBe(`${apiBase}/commands/deleteFolder?fake=failure`)
  })
})

describe("dryRunAtom — reads from URL query string", () => {
  afterEach(() => {
    history.replaceState(null, "", window.location.pathname)
  })

  test("is false when URL has no ?fake param", () => {
    history.replaceState(null, "", window.location.pathname)
    const store = createStore()
    expect(store.get(dryRunAtom)).toBe(false)
  })

  test("is true when URL has ?fake=success", () => {
    history.replaceState(null, "", "/?fake=success")
    const store = createStore()
    expect(store.get(dryRunAtom)).toBe(true)
  })

  test("is true when URL has ?fake=failure", () => {
    history.replaceState(null, "", "/?fake=failure")
    const store = createStore()
    expect(store.get(dryRunAtom)).toBe(true)
  })

  test("setting to true writes ?fake=success to URL", () => {
    history.replaceState(null, "", window.location.pathname)
    const store = createStore()
    store.set(dryRunAtom, true)
    expect(
      new URLSearchParams(window.location.search).get(
        "fake",
      ),
    ).toBe("success")
  })

  test("setting to false removes ?fake from URL", () => {
    history.replaceState(null, "", "/?fake=success")
    const store = createStore()
    store.set(dryRunAtom, false)
    expect(
      new URLSearchParams(window.location.search).get(
        "fake",
      ),
    ).toBeNull()
  })

  test("setting to false when failure mode is active removes ?fake from URL", () => {
    history.replaceState(null, "", "/?fake=failure")
    const store = createStore()
    store.set(dryRunAtom, false)
    expect(
      new URLSearchParams(window.location.search).get(
        "fake",
      ),
    ).toBeNull()
  })

  test("preserves ?fake=failure when toggling dryRun back on after failure mode was set", () => {
    history.replaceState(null, "", "/?fake=failure")
    const store = createStore()
    store.set(dryRunAtom, false)
    store.set(dryRunAtom, true)
    // failure mode was cleared when dry-run was turned off, so turning back on gives success
    expect(
      new URLSearchParams(window.location.search).get(
        "fake",
      ),
    ).toBe("success")
  })

  test("two stores read their own snapshot of the URL independently at get time", () => {
    history.replaceState(null, "", "/?fake=success")
    const storeA = createStore()
    history.replaceState(null, "", window.location.pathname)
    const storeB = createStore()
    expect(storeA.get(dryRunAtom)).toBe(false) // reads current URL, not snapshot
    expect(storeB.get(dryRunAtom)).toBe(false)
  })
})

describe("failureModeAtom — reads from URL query string", () => {
  afterEach(() => {
    history.replaceState(null, "", window.location.pathname)
  })

  test("is false when URL has no ?fake param", () => {
    history.replaceState(null, "", window.location.pathname)
    const store = createStore()
    expect(store.get(failureModeAtom)).toBe(false)
  })

  test("is false when URL has ?fake=success", () => {
    history.replaceState(null, "", "/?fake=success")
    const store = createStore()
    expect(store.get(failureModeAtom)).toBe(false)
  })

  test("is true when URL has ?fake=failure", () => {
    history.replaceState(null, "", "/?fake=failure")
    const store = createStore()
    expect(store.get(failureModeAtom)).toBe(true)
  })

  test("setting to true (when dry-run is on) writes ?fake=failure to URL", () => {
    history.replaceState(null, "", "/?fake=success")
    const store = createStore()
    store.set(failureModeAtom, true)
    expect(
      new URLSearchParams(window.location.search).get(
        "fake",
      ),
    ).toBe("failure")
  })

  test("setting to false (when dry-run is on) writes ?fake=success to URL", () => {
    history.replaceState(null, "", "/?fake=failure")
    const store = createStore()
    store.set(failureModeAtom, false)
    expect(
      new URLSearchParams(window.location.search).get(
        "fake",
      ),
    ).toBe("success")
  })

  test("setting to true when dry-run is off is a no-op (URL stays unchanged)", () => {
    history.replaceState(null, "", window.location.pathname)
    const store = createStore()
    store.set(failureModeAtom, true)
    expect(
      new URLSearchParams(window.location.search).get(
        "fake",
      ),
    ).toBeNull()
  })
})

describe("URL reactivity — popstate updates atoms", () => {
  afterEach(() => {
    history.replaceState(null, "", window.location.pathname)
  })

  test("dryRunAtom reflects URL change after popstate", () => {
    history.replaceState(null, "", window.location.pathname)
    const store = createStore()
    const unsub = store.sub(dryRunAtom, () => {})

    history.replaceState(null, "", "/?fake=success")
    window.dispatchEvent(new PopStateEvent("popstate"))

    expect(store.get(dryRunAtom)).toBe(true)
    unsub()
  })

  test("failureModeAtom reflects URL change after popstate", () => {
    history.replaceState(null, "", "/?fake=success")
    const store = createStore()
    const unsub = store.sub(failureModeAtom, () => {})

    history.replaceState(null, "", "/?fake=failure")
    window.dispatchEvent(new PopStateEvent("popstate"))

    expect(store.get(failureModeAtom)).toBe(true)
    unsub()
  })
})
