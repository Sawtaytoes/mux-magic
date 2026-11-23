import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

// memfs ignores the umask and never reuses a file's mode, which is exactly
// where a replaced settings file can lose or widen its permissions. These
// cases run on the real file system, in a temporary folder.
vi.unmock("node:fs")
vi.unmock("node:fs/promises")

const { applyMakeMkvPrivacySettings } = await import(
  "./makeMkvPrivacySettings.js"
)

const settingsText = 'app_Key = "T-placeholder-key"\n'

const testState = {
  homePath: "",
  originalUmask: 0,
}

const getSettingsFilePath = () =>
  join(testState.homePath, ".MakeMKV", "settings.conf")

const writeOriginalSettings = (mode: number) => {
  mkdirSync(join(testState.homePath, ".MakeMKV"), {
    recursive: true,
  })
  writeFileSync(getSettingsFilePath(), settingsText)
  chmodSync(getSettingsFilePath(), mode)
}

beforeEach(() => {
  testState.homePath = mkdtempSync(
    join(tmpdir(), "mux-magic-makemkv-settings-"),
  )
  testState.originalUmask = process.umask()
})

afterEach(() => {
  process.umask(testState.originalUmask)
  rmSync(testState.homePath, { recursive: true })
})

describe("replacing settings.conf on a real file system", () => {
  test("keeps group write access under a 0022 umask", () => {
    writeOriginalSettings(0o660)
    process.umask(0o022)

    applyMakeMkvPrivacySettings(testState.homePath)

    expect(
      statSync(getSettingsFilePath()).mode & 0o7777,
    ).toBe(0o660)
    expect(
      readFileSync(getSettingsFilePath(), "utf8"),
    ).toBe(
      'app_Key = "T-placeholder-key"\napp_AutoSubmitEnabled = "0"\napp_UpdateEnable = "0"\n',
    )
  })

  test("does not widen a private file through a stale temporary file", () => {
    writeOriginalSettings(0o600)
    const staleFilePath = `${getSettingsFilePath()}.mux-magic-${process.pid}.tmp`
    writeFileSync(staleFilePath, "stale")
    chmodSync(staleFilePath, 0o644)
    process.umask(0o000)

    applyMakeMkvPrivacySettings(testState.homePath)

    expect(
      statSync(getSettingsFilePath()).mode & 0o7777,
    ).toBe(0o600)
    // The stale file is not ours to delete or reuse.
    expect(
      readdirSync(
        join(testState.homePath, ".MakeMKV"),
      ).sort(),
    ).toEqual([
      "settings.conf",
      `settings.conf.mux-magic-${process.pid}.tmp`,
    ])
  })

  test("creates a new settings file private to its owner", () => {
    process.umask(0o000)

    applyMakeMkvPrivacySettings(testState.homePath)

    expect(
      statSync(getSettingsFilePath()).mode & 0o7777,
    ).toBe(0o600)
  })
})
