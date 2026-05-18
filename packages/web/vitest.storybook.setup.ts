import { vi } from "vitest"

// Stories don't need a real SSE pipeline — the mock-server plugin can only
// keep connections silent, so opening EventSources in stories wastes the
// chromium browser worker's startup budget and contributes to the addon-vitest
// runner-registration race. No-op the hook so stories render synchronously.
vi.mock("./src/hooks/useTolerantEventSource", () => ({
  useTolerantEventSource: vi.fn(),
}))
