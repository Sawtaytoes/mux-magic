import { describe, expect, test, vi } from "vitest"
import { decodeCueBuffer } from "./readCueWithEncodingFallback.js"

// The repo-wide test setup mocks `node:fs` with memfs, so we use
// vi.importActual to reach the real filesystem just for loading
// committed fixture bytes. The function under test (`decodeCueBuffer`)
// is a pure buffer → string transform — no fs access of its own.

const loadFixture = async (
  filename: string,
): Promise<Buffer> => {
  const { readFileSync } =
    await vi.importActual<typeof import("node:fs")>(
      "node:fs",
    )
  const { join } =
    await vi.importActual<typeof import("node:path")>(
      "node:path",
    )
  return readFileSync(
    join(
      __dirname,
      "__fixtures__",
      "cue-encodings",
      filename,
    ),
  )
}

describe(decodeCueBuffer.name, () => {
  test("decodes a UTF-8 CUE with ASCII track titles", async () => {
    const buf = await loadFixture("utf8-ascii.cue")
    const text = decodeCueBuffer(buf)
    expect(text).toMatch(/Hello World/)
    expect(text).toMatch(/Second Track/)
  })

  test("decodes a Windows-1252 CUE that contains é", async () => {
    const buf = await loadFixture("windows-1252-accent.cue")
    const text = decodeCueBuffer(buf)
    expect(text).toMatch(/Café au lait/)
    expect(text).toMatch(/Soirée/)
  })

  test("decodes a Shift_JIS CUE with Japanese kana titles", async () => {
    const buf = await loadFixture("shift-jis-kana.cue")
    const text = decodeCueBuffer(buf)
    expect(text).toMatch(/残酷な天使のテーゼ/)
    expect(text).toMatch(/魂のルフラン/)
  })

  test("does not throw on a garbage byte buffer", () => {
    const garbage = Buffer.from([
      0xff, 0xfe, 0xab, 0xcd, 0x00, 0x7f, 0x80,
    ])
    expect(() => decodeCueBuffer(garbage)).not.toThrow()
  })
})
