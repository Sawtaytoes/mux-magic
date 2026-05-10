#!/usr/bin/env node
/**
 * Stamps a build identity into `public/api/version.json` so the running
 * server can answer "is this image current?" via /version, the boot
 * banner, and the UI footer — without any caller having to remember a
 * --build-arg.
 *
 * Resolution order (mirrors docs/options/version-display.md):
 *
 *   gitSha:    process.env.GIT_SHA  ||  `git rev-parse HEAD`        ||  "unknown"
 *   buildTime: process.env.BUILD_TIME || new Date().toISOString()
 *
 * Wired to `prebuild` and `prestart`/`preserver`/`preapi-server` /
 * `preapi-dev-server` in package.json so every entry point that boots a
 * server (or every Docker build) ends up with a fresh version.json next
 * to the static assets that `hono-routes` already serves from
 * `./public/api`. The route handler in `versionRoutes.ts` reads this
 * file at request time so dev edits without re-running the script still
 * yield a sensible response.
 */

"use strict"

const { execSync } = require("node:child_process")
const {
  mkdirSync,
  writeFileSync,
  readFileSync,
} = require("node:fs")
const { dirname, join } = require("node:path")

const repoRoot = join(__dirname, "..")
const outPath = join(
  repoRoot,
  "public",
  "api",
  "version.json",
)

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

const gitShaLong =
  process.env.GIT_SHA ||
  tryGit("rev-parse HEAD") ||
  "unknown"

const gitShaShort =
  gitShaLong === "unknown"
    ? "unknown"
    : gitShaLong.slice(0, 7)

const buildTime =
  process.env.BUILD_TIME || new Date().toISOString()

const packageJson = JSON.parse(
  readFileSync(join(repoRoot, "package.json"), "utf8"),
)

const payload = {
  gitSha: gitShaLong,
  gitShaShort,
  buildTime,
  packageVersion: packageJson.version || null,
  nodeVersion: process.version,
}

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(
  outPath,
  `${JSON.stringify(payload, null, 2)}\n`,
  "utf8",
)

console.log(
  `[build-version] wrote ${outPath} (git=${gitShaShort} built=${buildTime} v=${payload.packageVersion} node=${payload.nodeVersion})`,
)
