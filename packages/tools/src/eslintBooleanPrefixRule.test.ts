import { ESLint } from "eslint"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { expect, test } from "vitest"

const workspaceRoot = resolve(
  fileURLToPath(import.meta.url),
  "../../../..",
)

const fixturePath = resolve(
  workspaceRoot,
  "packages/tools/src/__fixtures__/badBooleanName.ts",
)

test(
  "boolean variable without is/has prefix triggers naming-convention error",
  async () => {
    const eslint = new ESLint({ cwd: workspaceRoot })
    const [result] = await eslint.lintFiles([fixturePath])
    // suppressedMessages items are LintMessage objects extended with `suppressions`
    // (not wrapped in a { message } envelope), so spread them directly.
    const namingViolations = [
      ...result.messages,
      ...result.suppressedMessages,
    ].filter(
      (message) => message.ruleId === "@typescript-eslint/naming-convention",
    )
    expect(namingViolations.length).toBeGreaterThan(0)
  },
  30_000,
)
