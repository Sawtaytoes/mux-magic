import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

// Side-effect-only module. Logs a one-liner build banner on import so
// the very first line of every server boot names the git sha + build
// time that's about to listen on the port.
//
// Mirrors the /version JSON and the UI footer — same source-of-truth
// `public/api/version.json` written by `scripts/build-version.cjs` at
// `prebuild`/`prestart`. If that file is missing (someone ran
// `tsx src/start-servers.ts` directly without going through yarn), we
// degrade to a "git=dev" line rather than crashing the boot.

const moduleDir = dirname(fileURLToPath(import.meta.url))
const versionPath = join(moduleDir, "..", "public", "api", "version.json")

try {
  const raw = readFileSync(versionPath, "utf8")
  const data = JSON.parse(raw) as {
    gitSha?: string
    gitShaShort?: string
    buildTime?: string | null
    packageVersion?: string | null
    nodeVersion?: string
  }
  const sha = data.gitShaShort || data.gitSha || "unknown"
  const built = data.buildTime || "unknown"
  const pkg = data.packageVersion ? "v" + data.packageVersion : "v0.0.0"
  const node = data.nodeVersion || process.version
  console.log(
    `media-tools git=${sha} built=${built} ${pkg} node=${node}`,
  )
}
catch {
  console.log(
    `media-tools git=dev built=unknown v0.0.0 node=${process.version}`,
  )
}
