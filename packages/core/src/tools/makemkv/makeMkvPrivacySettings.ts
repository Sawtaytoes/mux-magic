import { randomUUID } from "node:crypto"
import {
  chmodSync,
  chownSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { join } from "node:path"

// Settings that stop MakeMKV from contacting makemkv.com on its own.
// `app_UpdateEnable` is the update check behind MSG:5074 ("Automatic
// checking for updates is enabled"); with it at "0", makemkvcon stops
// printing MSG:5074 and stops writing `.MakeMKV/update.conf`.
// `app_AutoSubmitEnabled` is the preference "Submit dumps automatically",
// which uploads diagnostic dumps.
// Both stay off because no telemetry or phone-home stays on. See
// docs/decisions/2026-11-23-makemkv-is-pinned-to-1-18-4-and-never-phones-home.md.
export const makeMkvPrivacySettings: Record<
  string,
  string
> = {
  app_AutoSubmitEnabled: "0",
  app_UpdateEnable: "0",
}

const settingNamePattern = /^\s*([A-Za-z0-9_]+)\s*=/

const getSettingName = (line: string) =>
  line.match(settingNamePattern)?.[1] ?? null

const formatSettingLine = ({
  name,
  value,
}: {
  name: string
  value: string
}) => `${name} = "${value}"`

// MakeMKV writes `settings.conf` as `name = "value"` lines under a comment
// header. Every other line, the registration key included, is kept as it
// is; each named setting is replaced where it appears and appended where it
// does not.
export const setMakeMkvSettingsInText = ({
  settings,
  settingsText,
}: {
  settings: Record<string, string>
  settingsText: string
}) =>
  ((lines) =>
    lines
      .map((line) =>
        ((name) =>
          name !== null && Object.hasOwn(settings, name)
            ? formatSettingLine({
                name,
                value: settings[name],
              })
            : line)(getSettingName(line)),
      )
      .concat(
        Object.keys(settings)
          .filter(
            (name) =>
              !lines.some(
                (line) => getSettingName(line) === name,
              ),
          )
          .map((name) =>
            formatSettingLine({
              name,
              value: settings[name],
            }),
          ),
      )
      .join("\n")
      .concat("\n"))(
    settingsText === ""
      ? []
      : settingsText.replace(/\n$/, "").split("\n"),
  )

// The file holds the registration key, so it is never truncated in place:
// a failed write (a full disk, say) would leave it empty. The new text goes
// to a temporary file beside it, which is then renamed over the original.
//
// The temporary file gets a unique name and is created exclusively ("wx"),
// so a stale file left by a crash can never be reused with its own
// permissions. Its owner is copied from the original, and its mode is set
// with chmod after the chown, because the `mode` passed to a create is
// filtered by the process umask. A new file is created 0600, since it may
// soon hold a key. On any failure the temporary file is removed and the
// original is untouched.
const replaceFileAtomically = ({
  filePath,
  text,
}: {
  filePath: string
  text: string
}) => {
  const temporaryFilePath = `${filePath}.mux-magic-${randomUUID()}.tmp`
  const originalStats = existsSync(filePath)
    ? statSync(filePath)
    : null

  try {
    writeFileSync(temporaryFilePath, text, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    })

    if (originalStats !== null) {
      chownSync(
        temporaryFilePath,
        originalStats.uid,
        originalStats.gid,
      )
    }

    chmodSync(
      temporaryFilePath,
      originalStats === null
        ? 0o600
        : originalStats.mode & 0o7777,
    )
    renameSync(temporaryFilePath, filePath)
  } catch (error) {
    rmSync(temporaryFilePath, { force: true })
    throw error
  }
}

// Runs before every makemkvcon spawn, so a settings file that was replaced
// by hand (a new key, say) is corrected before MakeMKV reads it. The file
// is written only when a setting changes.
export const applyMakeMkvPrivacySettings = (
  makeMkvHomePath: string,
) => {
  const settingsFolderPath = join(
    makeMkvHomePath,
    ".MakeMKV",
  )
  const settingsFilePath = join(
    settingsFolderPath,
    "settings.conf",
  )
  const originalText = existsSync(settingsFilePath)
    ? readFileSync(settingsFilePath, "utf8")
    : ""
  const updatedText = setMakeMkvSettingsInText({
    settings: makeMkvPrivacySettings,
    settingsText: originalText,
  })

  if (updatedText !== originalText) {
    mkdirSync(settingsFolderPath, { recursive: true })
    replaceFileAtomically({
      filePath: settingsFilePath,
      text: updatedText,
    })
  }
}
