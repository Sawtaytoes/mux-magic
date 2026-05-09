import { spawn } from "node:child_process"
import { platform } from "node:os"

import { validateReadablePath } from "./pathSafety.js"

// Hands a file off to the OS so the user's default app for that
// extension opens it (VLC for .mkv, etc.). Used by the file-explorer
// modal as a fallback when a file's codecs can't be played in-browser
// (DTS, TrueHD, HEVC without hardware decode).
//
// Per-platform launcher:
//   Windows  → cmd.exe /C start "" "<path>"   (start is a cmd builtin;
//              the empty quoted "" is the literal window-title arg —
//              without it `start` interprets the path as a title.)
//   macOS    → open "<path>"
//   Linux    → xdg-open "<path>"
//
// All three use spawn (detached + unref) so the child outlives the API
// request and the parent can return immediately. spawn instead of
// execFile so the path argument doesn't get parsed by a shell — the
// arg array stays literal.
export const openInExternalApp = (path: string): void => {
  const validatedPath = validateReadablePath(path)
  const os = platform()
  let command: string
  let args: string[]

  if (os === "win32") {
    command = "cmd.exe"
    // /C runs the command and exits. `start` is a cmd builtin, so it
    // has to go through cmd. The empty "" is the title arg `start`
    // requires when the next arg is a quoted path.
    args = ["/C", "start", "", validatedPath]
  }
  else if (os === "darwin") {
    command = "open"
    args = [validatedPath]
  }
  else {
    // Linux + everything else. xdg-open is the freedesktop standard;
    // missing on minimal containers but typical desktop installs ship
    // it. The error path is a no-op since we detach + unref.
    command = "xdg-open"
    args = [validatedPath]
  }

  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  })
  // Don't keep the parent process alive waiting on the launched app.
  child.unref()
}
