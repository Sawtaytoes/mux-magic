#!/usr/bin/env node
// Copies the `assets/` directory from the main worktree into the current git
// worktree when they differ. Assets (ffmpeg, mediainfo, mkvtoolnix binaries)
// are not tracked in git, so they exist only in the main worktree checkout and
// must be copied on first use in any sibling worktree.
//
// No-ops when:
//   - already in the main worktree (source === destination)
//   - source assets directory does not exist (CI / Docker, uses PATH binaries)
//   - destination assets directory already exists (already copied)

"use strict"

const { execSync } = require("node:child_process")
const { cpSync, existsSync } = require("node:fs")
const { join, resolve } = require("node:path")

const repoRoot = join(__dirname, "..")

const tryGit = (args) => {
  try {
    return execSync(`git ${args}`, {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim()
  } catch {
    return ""
  }
}

// git rev-parse --git-common-dir returns the path to the shared .git directory.
// In the main worktree this is ".git" (relative); in a sibling worktree it is
// an absolute path like /repo/.git. path.resolve handles both cases correctly:
// an absolute segment resets resolution so the repoRoot prefix is ignored.
const gitCommonDirectory = tryGit(
  "rev-parse --git-common-dir",
)
const mainRepoRoot = resolve(
  repoRoot,
  gitCommonDirectory,
  "..",
)
const sourceAssetsPath = join(mainRepoRoot, "assets")
const destinationAssetsPath = join(repoRoot, "assets")

const isAlreadyMainWorktree =
  sourceAssetsPath === destinationAssetsPath
const isSourceMissing = !existsSync(sourceAssetsPath)
const isDestinationPresent = existsSync(
  destinationAssetsPath,
)

if (
  isAlreadyMainWorktree ||
  isSourceMissing ||
  isDestinationPresent
) {
  process.exit(0)
}

console.log(
  `[copy-assets] ${sourceAssetsPath} → ${destinationAssetsPath}`,
)
cpSync(sourceAssetsPath, destinationAssetsPath, {
  recursive: true,
})
console.log("[copy-assets] done")
