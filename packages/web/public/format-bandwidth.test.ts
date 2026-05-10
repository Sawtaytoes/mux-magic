// Tests for the shared bandwidth/ETA formatter (public/format-bandwidth.js).
//
// The formatter is a plain IIFE that attaches to `globalThis.BandwidthFormat`.
// We read it via the real (un-mocked) `node:fs` module using vi.importActual,
// then execute it in the current globalThis scope and verify the side-effect.

import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, test, vi } from "vitest"

const __dirname = path.dirname(
  fileURLToPath(import.meta.url),
)

// The node test project globally mocks node:fs with memfs. We bypass that
// by importing the real (actual) fs module before the formatter is loaded.
const realFs =
  await vi.importActual<typeof import("node:fs")>("node:fs")

const formatterSrc = realFs.readFileSync(
  path.resolve(
    __dirname,
    "../../public/format-bandwidth.js",
  ),
  "utf8",
) as string

// Execute the IIFE in the globalThis scope so BandwidthFormat gets attached.
 
new Function("globalThis", formatterSrc)(globalThis)

type BandwidthFormatGlobal = {
  BandwidthFormat: {
    formatBandwidth: (
      bytesPerSecond: number | null | undefined,
    ) => string
    formatRemaining: (
      bytesRemaining: number | null | undefined,
      bytesPerSecond: number | null | undefined,
    ) => string
    formatEta: (
      bytesRemaining: number | null | undefined,
      bytesPerSecond: number | null | undefined,
    ) => string
  }
}

const { formatBandwidth, formatRemaining, formatEta } = (
  globalThis as typeof globalThis & BandwidthFormatGlobal
).BandwidthFormat

// ─── formatBandwidth ─────────────────────────────────────────────────────────

describe("formatBandwidth", () => {
  test("converts bytes/s to bits/s (×8): 125 B/s = 1 kbps", () => {
    // 125 × 8 = 1000 bps = 1 kbps
    expect(formatBandwidth(125)).toBe("1 kbps")
  })

  test("kbps range: 100 kB/s → 800 kbps", () => {
    expect(formatBandwidth(100_000)).toBe("800 kbps")
  })

  test("kbps → Mbps boundary: 125_000 B/s = 1 Mbps", () => {
    // 125_000 × 8 = 1_000_000 bps = 1 Mbps
    expect(formatBandwidth(125_000)).toBe("1 Mbps")
  })

  test("Mbps range: 625_000 B/s → 5 Mbps", () => {
    // 625_000 × 8 = 5_000_000 bps = 5 Mbps
    expect(formatBandwidth(625_000)).toBe("5 Mbps")
  })

  test("Mbps large: 1_500_000 B/s → 12 Mbps", () => {
    // 1_500_000 × 8 = 12_000_000 bps = 12 Mbps
    expect(formatBandwidth(1_500_000)).toBe("12 Mbps")
  })

  test("Mbps with one decimal: 1_875_000 B/s → 15 Mbps", () => {
    expect(formatBandwidth(1_875_000)).toBe("15 Mbps")
  })

  test("Mbps → Gbps boundary: 125_000_000 B/s = 1 Gbps", () => {
    // 125_000_000 × 8 = 1_000_000_000 bps = 1 Gbps
    expect(formatBandwidth(125_000_000)).toBe("1 Gbps")
  })

  test("Gbps with decimal: 150_000_000 B/s → 1.2 Gbps", () => {
    // 150_000_000 × 8 = 1_200_000_000 bps = 1.2 Gbps
    expect(formatBandwidth(150_000_000)).toBe("1.2 Gbps")
  })

  test("Gbps range: 625_000_000 B/s → 5 Gbps", () => {
    expect(formatBandwidth(625_000_000)).toBe("5 Gbps")
  })

  test("sub-kbps falls through to bps: 100 B/s = 800 bps", () => {
    expect(formatBandwidth(100)).toBe("800 bps")
  })

  test('returns "" for 0', () => {
    expect(formatBandwidth(0)).toBe("")
  })

  test('returns "" for negative', () => {
    expect(formatBandwidth(-1)).toBe("")
  })

  test('returns "" for null', () => {
    expect(formatBandwidth(null as unknown as number)).toBe(
      "",
    )
  })

  test('returns "" for undefined', () => {
    expect(
      formatBandwidth(undefined as unknown as number),
    ).toBe("")
  })
})

// ─── formatRemaining ─────────────────────────────────────────────────────────

describe("formatRemaining", () => {
  test("seconds only when under 1 minute: 45_000 B at 1_000 B/s = 45s", () => {
    expect(formatRemaining(45_000, 1_000)).toBe("45s")
  })

  test("minutes + seconds: 192_000 B at 1_000 B/s = 3m 12s", () => {
    expect(formatRemaining(192_000, 1_000)).toBe("3m 12s")
  })

  test("hours + minutes (no seconds at hour scale): 9_900_000 B at 1_000 B/s = 2h 45m", () => {
    expect(formatRemaining(9_900_000, 1_000)).toBe("2h 45m")
  })

  test("exact 1 minute boundary: 60_000 B at 1_000 B/s = 1m 0s", () => {
    expect(formatRemaining(60_000, 1_000)).toBe("1m 0s")
  })

  test("exact 1 hour boundary: 3_600_000 B at 1_000 B/s = 1h 0m", () => {
    expect(formatRemaining(3_600_000, 1_000)).toBe("1h 0m")
  })

  test('returns "" when bytesRemaining is 0', () => {
    expect(formatRemaining(0, 1_000)).toBe("")
  })

  test('returns "" when bytesRemaining is negative', () => {
    expect(formatRemaining(-1, 1_000)).toBe("")
  })

  test('returns "" when bytesPerSecond is 0 (no speed data yet)', () => {
    expect(formatRemaining(100_000, 0)).toBe("")
  })

  test('returns "" when bytesPerSecond is negative', () => {
    expect(formatRemaining(100_000, -1)).toBe("")
  })

  test('returns "" when both args are 0', () => {
    expect(formatRemaining(0, 0)).toBe("")
  })

  test('returns "" for null bytesRemaining', () => {
    expect(
      formatRemaining(null as unknown as number, 1_000),
    ).toBe("")
  })

  test('returns "" for null bytesPerSecond', () => {
    expect(
      formatRemaining(100_000, null as unknown as number),
    ).toBe("")
  })
})

// ─── formatEta ───────────────────────────────────────────────────────────────

describe("formatEta", () => {
  test('prepends "in " for seconds', () => {
    expect(formatEta(45_000, 1_000)).toBe("in 45s")
  })

  test('prepends "in " for minutes + seconds', () => {
    expect(formatEta(192_000, 1_000)).toBe("in 3m 12s")
  })

  test('prepends "in " for hours + minutes', () => {
    expect(formatEta(9_900_000, 1_000)).toBe("in 2h 45m")
  })

  test('returns "" when remaining is zero', () => {
    expect(formatEta(0, 1_000)).toBe("")
  })

  test('returns "" when speed is zero', () => {
    expect(formatEta(100_000, 0)).toBe("")
  })
})
