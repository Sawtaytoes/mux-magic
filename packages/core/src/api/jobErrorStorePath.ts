import { homedir, platform } from "node:os"
import { join } from "node:path"

const resolveAppDataDir = (): string => {
  const explicit = process.env.MUX_MAGIC_DATA_DIR
  if (explicit !== undefined && explicit !== "")
    return explicit

  if (platform() === "win32") {
    const appData = process.env.APPDATA
    if (appData !== undefined && appData !== "") {
      return join(appData, "mux-magic")
    }
    return join(
      homedir(),
      "AppData",
      "Roaming",
      "mux-magic",
    )
  }

  const xdg = process.env.XDG_DATA_HOME
  if (xdg !== undefined && xdg !== "") {
    return join(xdg, "mux-magic")
  }

  return join(homedir(), ".local", "share", "mux-magic")
}

export const resolveJobErrorsFilePath = (): string =>
  join(resolveAppDataDir(), "job-errors.json")
