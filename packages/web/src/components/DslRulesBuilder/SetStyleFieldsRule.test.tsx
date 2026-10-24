import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { afterEach, expect, test, vi } from "vitest"
import { SetStyleFieldsRuleBody } from "./SetStyleFieldsRule"
import type { DslRule, SetStyleFieldsRule } from "./types"

afterEach(cleanup)

const RuleHarness = ({
  isReadOnly = false,
}: {
  isReadOnly?: boolean
}) => {
  const [rules, setRules] = useState<DslRule[]>([
    {
      type: "setStyleFields",
      fields: { MarginV: "90" },
      ignoredStyleNamesRegexString: "signs?",
      ignoredStyleNameWords: ["OP"],
    },
  ])
  return (
    <>
      <SetStyleFieldsRuleBody
        rules={rules}
        ruleIndex={0}
        rule={rules[0] as SetStyleFieldsRule}
        predicates={{}}
        isReadOnly={isReadOnly}
        stepId="step3"
        openDetailsKeys={new Set()}
        onToggleDetails={vi.fn()}
        onCommitRules={setRules}
      />
      <output aria-label="Committed style rule">
        {JSON.stringify(rules[0])}
      </output>
    </>
  )
}

test("commits ignored style words without changing fields or the custom regex", async () => {
  const user = userEvent.setup()
  render(<RuleHarness />)
  const input = screen.getByLabelText("Ignore style words")
  await user.clear(input)
  await user.type(input, "OP, ED NCOP")
  await user.tab()
  expect(
    screen.getByLabelText("Committed style rule"),
  ).toHaveTextContent(
    '"ignoredStyleNameWords":["OP","ED","NCOP"]',
  )
  expect(
    screen.getByLabelText("Committed style rule"),
  ).toHaveTextContent(
    '"ignoredStyleNamesRegexString":"signs?"',
  )
  expect(
    screen.getByLabelText("Committed style rule"),
  ).toHaveTextContent('"MarginV":"90"')
})

test("keeps the ignored words visible and unchanged in read-only mode", async () => {
  const user = userEvent.setup()
  render(<RuleHarness isReadOnly />)
  const input = screen.getByLabelText("Ignore style words")
  expect(input).toHaveValue("OP")
  expect(input).toHaveAttribute("readonly")
  await user.type(input, "ED")
  expect(input).toHaveValue("OP")
})
