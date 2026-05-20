import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"
import * as jobStore from "../api/jobStore.js"
import { withJobContext } from "../api/logCapture.js"
import {
  resetPromptStore,
  resolvePrompt,
} from "../api/promptStore.js"
import { getUserSearchInput } from "./getUserSearchInput.js"

// The cancel-job teardown contract — when the outer observable is
// externally unsubscribed (e.g. `DELETE /jobs/:id` cascades through
// `jobStore.cancelJob` → `subscription.unsubscribe`), the teardown
// function returned by `getUserSearchInput`'s Observable constructor
// MUST call `cancelPrompt(promptId)` so the in-flight entry doesn't
// leak in the promptStore Map forever. This is the load-bearing
// wiring that lets the NSF fake-data scenario (and every real
// prompt-using pipeline) actually be cancellable while paused on
// user input.
describe("getUserSearchInput teardown", () => {
  beforeEach(() => {
    resetPromptStore()
  })
  afterEach(() => {
    resetPromptStore()
    vi.restoreAllMocks()
  })

  test("unsubscribing before the prompt is answered cancels the pending entry (resolvePrompt no longer finds it)", () => {
    // Spy on emitJobEvent to capture the promptId getUserSearchInput
    // generated — promptIds are uuids, so we'd otherwise have no way
    // to reach the pending entry from the outside.
    let capturedPromptId: string | null = null
    vi.spyOn(jobStore, "emitJobEvent").mockImplementation(
      (_jobId, event) => {
        if (event.type === "prompt") {
          capturedPromptId = event.promptId
        }
      },
    )

    const subscription = withJobContext(
      "job-teardown",
      () =>
        getUserSearchInput({
          message: "Pick one",
          options: [{ index: 1, label: "A" }],
        }).subscribe(),
    )

    expect(capturedPromptId).not.toBeNull()
    if (capturedPromptId === null)
      throw new Error("promptId was not captured")

    subscription.unsubscribe()

    // resolvePrompt returns true ONLY if the id is still registered.
    // After teardown, cancelPrompt removed it — so this must return
    // false. (Before this contract existed, the entry leaked and
    // resolvePrompt would have returned true.)
    expect(resolvePrompt(capturedPromptId, 0)).toBe(false)
  })

  test("naturally-resolving prompt does NOT double-delete (resolvePrompt removes the entry; teardown is a no-op)", () => {
    let capturedPromptId: string | null = null
    vi.spyOn(jobStore, "emitJobEvent").mockImplementation(
      (_jobId, event) => {
        if (event.type === "prompt") {
          capturedPromptId = event.promptId
        }
      },
    )

    const subscription = withJobContext("job-resolve", () =>
      getUserSearchInput({
        message: "Pick one",
        options: [{ index: 1, label: "A" }],
      }).subscribe(),
    )

    expect(capturedPromptId).not.toBeNull()
    if (capturedPromptId === null)
      throw new Error("promptId was not captured")

    // Resolve through the normal path — resolvePrompt deletes the
    // entry and fulfills the inner promise. cancelPrompt is
    // documented as idempotent (promptStore.ts:33) so the teardown
    // path's belt-and-suspenders cancelPrompt is safe regardless of
    // microtask ordering — the assertion we care about is that the
    // entry was deleted exactly once, which we prove with the
    // second resolvePrompt returning false.
    expect(resolvePrompt(capturedPromptId, 7)).toBe(true)
    subscription.unsubscribe()

    // The entry is gone after the FIRST resolve; the second attempt
    // (and the teardown's cancelPrompt) all see an empty slot.
    expect(resolvePrompt(capturedPromptId, 99)).toBe(false)
  })
})
