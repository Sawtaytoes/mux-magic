import { spawnSync } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, test } from "vitest"

// Module dir so the spawn is cwd-independent. `tsx` lives in the
// closest node_modules/.bin, which yarn 4 resolves from the package
// root for workspace consumers.
const packageRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
)
const cliEntry = resolve(packageRoot, "src/cli.ts")

describe("@mux-magic/cli --help", () => {
  test("exits 0 and prints the registered command names", () => {
    const result = spawnSync(`tsx "${cliEntry}" --help`, {
      cwd: packageRoot,
      encoding: "utf8",
      shell: true,
    })

    expect(result.status).toBe(0)

    const help = `${result.stdout}\n${result.stderr}`
    expect(help).toContain("changeTrackLanguages")
    expect(help).toContain("addSubtitles")
    expect(help).toContain("mergeTracks")
    expect(help).toContain("nameAnimeEpisodes")
  })
})
