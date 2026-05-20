import { spawnSync } from "node:child_process"
import { readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { constants, gzipSync } from "node:zlib"
import { describe, expect, test } from "vitest"

// Worker 79: assert the production build stays free of the
// `INEFFECTIVE_DYNAMIC_IMPORT` warning and that the BuilderPage modal
// subtree + yamlCodec have actually been code-split out of the main
// chunk. Spawning `vite build` is expensive (~5s warm) so this test is
// gated behind `RUN_BUILD_BUDGET=1` (default OFF) — CI invokes the
// dedicated workflow step explicitly. Local `yarn test` is unaffected
// because this config isn't part of the default web vitest project.
const isEnabled = process.env.RUN_BUILD_BUDGET === "1"
const testOrSkip = isEnabled ? test : test.skip

const PACKAGE_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
)
const DIST_ASSETS = join(PACKAGE_ROOT, "dist", "assets")

// Threshold reasoning: pre-worker-79 the main chunk was ~287 kB gzip.
// After splitting the 12 modals + yamlCodec it lands around ~248 kB
// gzip. We allow 260 kB to give React Compiler-generated memoization
// some headroom as the BuilderPage grows — but the threshold is well
// under the original 287 kB, so a regression that re-inlines the
// modals or yamlCodec will trip the test. Hitting the worker doc's
// stretch target of <220 kB would require lazy-loading first-paint
// components (BuilderSequenceList / the pickers), which is out of
// scope per the worker spec.
const MAIN_CHUNK_GZIP_MAX_KB = 260

const MODAL_CHUNK_NAMES = [
  "LoadModal",
  "YamlModal",
  "SequenceRunModal",
  "SmartMatchModal",
  "FileExplorerModal",
  "EditVariablesModal",
  "CommandHelpModal",
  "LookupModal",
  "PromptModal",
  "AudioPreviewModal",
  "ImagePreviewModal",
  "VideoPreviewModal",
]

const runBuild = (): string => {
  const result = spawnSync("yarn", ["vite", "build"], {
    cwd: PACKAGE_ROOT,
    encoding: "utf8",
    // shell: true so `yarn` resolves via PATH on Windows where the
    // entry is a `.cmd` shim.
    shell: true,
    // Vitest sets NODE_ENV=test on its workers; if that leaks into the
    // spawned vite build, vite skips its production minification path
    // and the main chunk balloons ~20%. Force production explicitly.
    env: { ...process.env, NODE_ENV: "production" },
  })
  if (result.status !== 0) {
    throw new Error(
      `vite build failed (exit ${result.status}):\n${result.stdout}\n${result.stderr}`,
    )
  }
  return `${result.stdout ?? ""}\n${result.stderr ?? ""}`
}

describe("web build budget (worker 79)", () => {
  testOrSkip(
    "build is free of INEFFECTIVE_DYNAMIC_IMPORT and main chunk is split",
    () => {
      const buildOutput = runBuild()

      expect(buildOutput).not.toMatch(
        /INEFFECTIVE_DYNAMIC_IMPORT/,
      )

      const distFiles = readdirSync(DIST_ASSETS)

      const mainFile = distFiles.find((file) =>
        /^index-.*\.js$/.test(file),
      )
      expect(
        mainFile,
        "expected dist/assets/index-*.js to exist",
      ).toBeDefined()

      const mainBytes = readFileSync(
        join(DIST_ASSETS, mainFile as string),
      )
      // Vite's build reporter gzips at level 9; node's default is 6.
      // Match the reporter so this test agrees with the numbers users
      // see in `yarn build` output.
      const mainGzipKb =
        gzipSync(mainBytes, {
          level: constants.Z_BEST_COMPRESSION,
        }).byteLength / 1024
      expect(
        mainGzipKb,
        `main chunk gzip size (${mainGzipKb.toFixed(2)} kB) exceeds budget`,
      ).toBeLessThan(MAIN_CHUNK_GZIP_MAX_KB)

      const splitModalCount = MODAL_CHUNK_NAMES.filter(
        (modal) =>
          distFiles.some((file) =>
            new RegExp(`^${modal}-.*\\.js$`).test(file),
          ),
      ).length
      expect(
        splitModalCount,
        `expected at least 6 modal chunks emitted to dist/assets/, found ${splitModalCount}`,
      ).toBeGreaterThanOrEqual(6)

      const hasYamlCodecChunk = distFiles.some((file) =>
        /^yamlCodec-.*\.js$/.test(file),
      )
      expect(
        hasYamlCodecChunk,
        "expected yamlCodec-*.js async chunk to exist (js-yaml split out of main)",
      ).toBe(true)
    },
  )
})
