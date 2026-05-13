import { join } from "node:path"
import { describe, expect, test, vi } from "vitest"

vi.unmock("node:fs")

/**
 * @storybook/addon-vitest's VitestManager.startVitest constructs its project
 * filter as `"storybook:" + process.env.STORYBOOK_CONFIG_DIR` and passes it
 * to createVitest({ project: [projectName] }). Vitest matches this filter
 * against the registered project's test.name. For the filter to resolve, the
 * config must set test.name to "storybook:<absolutePathToStorybookConfigDir>".
 */
describe("packages/web/vitest.storybook.config.ts", () => {
  test("sets test.name to storybook:<configDir> to match the addon-vitest project filter", async () => {
    const { readFileSync } =
      await vi.importActual<typeof import("node:fs")>(
        "node:fs",
      )

    const configPath = join(
      import.meta.dirname,
      "../../web/vitest.storybook.config.ts",
    )
    const source = readFileSync(configPath, "utf-8")

    // The name must be a dynamic expression resolving to the absolute path of
    // the .storybook directory. Verify the config uses the join()-based pattern
    // rather than the bare string "storybook".
    expect(source).toMatch(/name:\s*`storybook:\$\{/)
    expect(source).not.toMatch(/name:\s*["']storybook["']/)
  })
})
