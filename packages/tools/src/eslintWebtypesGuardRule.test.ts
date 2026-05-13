import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { ESLint } from "eslint"
import { expect, test } from "vitest"

const workspaceRoot = resolve(
  fileURLToPath(import.meta.url),
  "../../../..",
)

const fixturePath = resolve(
  workspaceRoot,
  "packages/web/src/__eslintFixtures__/localApiShape.tsx",
)

test("local API-shape type declarations in packages/web trigger no-restricted-syntax error", async () => {
  const eslint = new ESLint({ cwd: workspaceRoot })
  const [result] = await eslint.lintFiles([fixturePath])
  const apiShapeViolations = [
    ...result.messages,
    ...result.suppressedMessages,
  ].filter(
    (message) => message.ruleId === "no-restricted-syntax",
  )
  expect(apiShapeViolations.length).toBeGreaterThan(0)
}, 30_000)
