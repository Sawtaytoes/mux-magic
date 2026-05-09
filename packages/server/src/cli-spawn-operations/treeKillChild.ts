import type { ChildProcess } from "node:child_process"

import treeKill from "tree-kill"

// Returns a cleanup function suitable as the teardown return value of
// `new Observable((observer) => { … return treeKillOnUnsubscribe(child) })`.
//
// Kills the entire child-process tree on unsubscribe. On Windows runs
// `taskkill /T /F /PID <pid>` (no process groups, so killing the direct
// child alone is not enough — ffmpeg sometimes spawns hardware-accel
// helpers, and we don't want those orphaned eating CPU/GPU after a
// cancelled job). On POSIX sends SIGTERM to the process group.
//
// Wrapped in try/catch because by the time the Observable is unsubscribed
// the child may already have exited naturally — tree-kill on a dead pid
// throws ESRCH which isn't actionable here.
export const treeKillOnUnsubscribe = (
  childProcess: ChildProcess,
): (() => void) => () => {
  if (childProcess.pid === undefined) return
  try {
    treeKill(childProcess.pid, "SIGTERM")
  } catch {
    // already exited / pid recycled — nothing to do
  }
}
