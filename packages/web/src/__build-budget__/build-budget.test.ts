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
// gzip. 260 kB gave React Compiler-generated memoization some headroom
// as the BuilderPage grew, well under the original 287 kB, so a
// regression that re-inlines the modals or yamlCodec trips the test.
// Hitting the worker doc's stretch target of <220 kB would require
// lazy-loading first-paint components (BuilderSequenceList / the
// pickers), which is out of scope per the worker spec.
//
// **Raised to 280 kB by charcuterie M6b.** Measured on the same build,
// gzip level 9: 253.28 kB before the migration, 275.18 kB after —
// **+21.90 kB gz** for `@charcuterie/ui` + `@charcuterie/logic` +
// `@floating-ui/react`.
//
// It is not slack and it cannot be split away. Tree-shaking is already
// working — `MediaTile`, `Skeleton`, `SegmentedControl`, `EmptyState`,
// `LiveStatusIndicator`, `Toast` and `FileDropZone` appear nowhere in
// the chunk — so this is only what the app actually renders. And
// `Tooltip` is on **every command field**, so `@floating-ui/react` is a
// first-paint dependency; moving `@charcuterie/ui` into a `manualChunks`
// entry would shrink `index-*.js` without shortening the critical path
// by a single byte, which is gaming this gate rather than passing it.
//
// 280 leaves ~5 kB of headroom and stays under the 287 kB the split was
// originally measured against. Deleted in exchange: `FieldTooltip`'s 130
// hand-rolled lines, `@radix-ui/react-popover`, and seven `<details>`
// reconciliation blocks.
//
// **Raised to 286 kB by the charcuterie M8 picker migration.** The seven
// hand-rolled pickers moved onto `@charcuterie/ui`'s `Combobox`/`Listbox`,
// which deletes far more app code than it adds (net −1.8k lines) but pulls
// `@tanstack/react-virtual` — Combobox's windowing dep — into the main chunk:
// the pickers are first-paint (a command picker sits on every `StepCard`), so
// it cannot be split off the critical path. Measured same build, gzip 9:
// 275.18 kB before → 283.22 kB after, **+8.04 kB gz** for `Combobox`/`Listbox`
// + `react-virtual` (`floating-ui` was already first-paint via `Tooltip`).
// 286 keeps ~2.8 kB headroom and still sits under the original 287 kB baseline,
// so it is a ceiling, not slack — and `manualChunks` is still off the table for
// the reason above: it would shrink `index-*.js` without shortening the
// critical path by a byte.
//
// **Cut to 110 kB when the routes became `lazy()`.** Every page is now split
// out of the entry, so `index-*.js` holds the shell and what all four routes
// share, not the Sequence Builder — 274.86 kB gzip before, **85.45 kB** after.
//
// The old ceiling was written when the entry *was* the app, and the note above
// about `manualChunks` "not shortening the critical path" is the reason this
// number could not move until now: splitting off a chunk everyone loads buys
// nothing, splitting off one that only `/builder` loads buys everything.
// Leaving 286 in place would be leaving a gate that cannot fail — a
// re-inlined BuilderPage would sail under it.
//
// ~24 kB of headroom for shared code that genuinely belongs on every route.
// If this needs raising, check first that the growth is actually shared and
// not a page leaking back into the entry.
const MAIN_CHUNK_GZIP_MAX_KB = 110

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
