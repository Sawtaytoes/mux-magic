import { readFileSync, statSync } from "node:fs"
import { fs as memoryFileSystem, vol } from "memfs"
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import {
  applyMakeMkvPrivacySettings,
  setMakeMkvSettingsInText,
} from "./makeMkvPrivacySettings.js"

// The shape MakeMKV v1.18.4 writes. The key is a placeholder.
const settingsWrittenByMakeMkv = [
  "#",
  "# MakeMKV settings file, written by MakeMKV v1.18.4 linux(x64-release)",
  "#",
  "",
  'app_DataDir = "/makemkv-config/.MakeMKV/data"',
  'app_Key = "T-placeholder-key"',
  'dvd_MinimumTitleLength = "10"',
  "",
].join("\n")

describe(setMakeMkvSettingsInText.name, () => {
  test("appends each missing setting and keeps every other line, the key included", () => {
    expect(
      setMakeMkvSettingsInText({
        settings: {
          app_AutoSubmitEnabled: "0",
          app_UpdateEnable: "0",
        },
        settingsText: settingsWrittenByMakeMkv,
      }),
    ).toBe(
      [
        "#",
        "# MakeMKV settings file, written by MakeMKV v1.18.4 linux(x64-release)",
        "#",
        "",
        'app_DataDir = "/makemkv-config/.MakeMKV/data"',
        'app_Key = "T-placeholder-key"',
        'dvd_MinimumTitleLength = "10"',
        'app_AutoSubmitEnabled = "0"',
        'app_UpdateEnable = "0"',
        "",
      ].join("\n"),
    )
  })

  test("turns off a setting that is on, in the line where it is", () => {
    expect(
      setMakeMkvSettingsInText({
        settings: { app_UpdateEnable: "0" },
        settingsText: [
          'app_UpdateEnable = "1"',
          'app_Key = "T-placeholder-key"',
          "",
        ].join("\n"),
      }),
    ).toBe(
      [
        'app_UpdateEnable = "0"',
        'app_Key = "T-placeholder-key"',
        "",
      ].join("\n"),
    )
  })

  test("does not treat a setting whose name only starts the same as a match", () => {
    expect(
      setMakeMkvSettingsInText({
        settings: { app_UpdateEnable: "0" },
        settingsText: 'app_UpdateEnableLater = "1"\n',
      }),
    ).toBe(
      'app_UpdateEnableLater = "1"\napp_UpdateEnable = "0"\n',
    )
  })

  test("leaves text that already has the settings unchanged", () => {
    const settingsText =
      'app_Key = "T-placeholder-key"\napp_UpdateEnable = "0"\n'

    expect(
      setMakeMkvSettingsInText({
        settings: { app_UpdateEnable: "0" },
        settingsText,
      }),
    ).toBe(settingsText)
  })

  test("writes only the settings when there is no file text", () => {
    expect(
      setMakeMkvSettingsInText({
        settings: { app_UpdateEnable: "0" },
        settingsText: "",
      }),
    ).toBe('app_UpdateEnable = "0"\n')
  })
})

describe(applyMakeMkvPrivacySettings.name, () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test("turns off the update check and disc-info submission in the mounted settings", () => {
    vol.fromJSON({
      "/makemkv-config/.MakeMKV/settings.conf":
        settingsWrittenByMakeMkv,
    })

    applyMakeMkvPrivacySettings("/makemkv-config")

    expect(
      readFileSync(
        "/makemkv-config/.MakeMKV/settings.conf",
        "utf8",
      ),
    ).toBe(
      settingsWrittenByMakeMkv.concat(
        'app_AutoSubmitEnabled = "0"\napp_UpdateEnable = "0"\n',
      ),
    )
  })

  test("does not rewrite a settings file that already has them off", () => {
    const settingsText = settingsWrittenByMakeMkv.concat(
      'app_AutoSubmitEnabled = "0"\napp_UpdateEnable = "0"\n',
    )
    vol.fromJSON({
      "/makemkv-config/.MakeMKV/settings.conf":
        settingsText,
    })
    const modifiedTime = new Date("2026-01-01T00:00:00Z")
    vol.utimesSync(
      "/makemkv-config/.MakeMKV/settings.conf",
      modifiedTime,
      modifiedTime,
    )

    applyMakeMkvPrivacySettings("/makemkv-config")

    expect(
      statSync("/makemkv-config/.MakeMKV/settings.conf")
        .mtime,
    ).toEqual(modifiedTime)
  })

  test("keeps the original settings, key included, when the replacement fails", () => {
    vol.fromJSON({
      "/makemkv-config/.MakeMKV/settings.conf":
        settingsWrittenByMakeMkv,
    })
    vi.spyOn(
      memoryFileSystem,
      "renameSync",
    ).mockImplementationOnce(() => {
      throw Object.assign(
        new Error("ENOSPC: no space left on device"),
        { code: "ENOSPC" },
      )
    })

    expect(() => {
      applyMakeMkvPrivacySettings("/makemkv-config")
    }).toThrow("ENOSPC")
    expect(
      readFileSync(
        "/makemkv-config/.MakeMKV/settings.conf",
        "utf8",
      ),
    ).toBe(settingsWrittenByMakeMkv)
    expect(
      vol.readdirSync("/makemkv-config/.MakeMKV"),
    ).toEqual(["settings.conf"])
  })

  test("gives the replaced file the original's mode", () => {
    vol.fromJSON({
      "/makemkv-config/.MakeMKV/settings.conf":
        settingsWrittenByMakeMkv,
    })
    vol.chmodSync(
      "/makemkv-config/.MakeMKV/settings.conf",
      0o640,
    )

    applyMakeMkvPrivacySettings("/makemkv-config")

    expect(
      statSync("/makemkv-config/.MakeMKV/settings.conf")
        .mode & 0o7777,
    ).toBe(0o640)
  })

  test("creates the settings file when the home has none yet", () => {
    vol.mkdirSync("/makemkv-config", { recursive: true })

    applyMakeMkvPrivacySettings("/makemkv-config")

    expect(
      readFileSync(
        "/makemkv-config/.MakeMKV/settings.conf",
        "utf8",
      ),
    ).toBe(
      'app_AutoSubmitEnabled = "0"\napp_UpdateEnable = "0"\n',
    )
  })
})
