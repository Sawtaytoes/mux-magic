import { IconButton, Select } from "@charcuterie/ui"
import { useState } from "react"
import { isPlainObject } from "./clauseUtils"
import {
  moveComputeFromOp,
  removeComputeFromOp,
  setComputeFromOpOperand,
  setComputeFromOpVerb,
} from "./computeMutations"
import {
  COMPUTE_FROM_OPS_ALL,
  COMPUTE_FROM_OPS_BARE,
  type ComputeFromOp,
  type DslRule,
} from "./types"

export const ComputeFromOpRow = ({
  rules,
  ruleIndex,
  fieldKey,
  opIndex,
  op,
  isReadOnly,
  isFirst,
  isLast,
  onCommitRules,
}: {
  rules: DslRule[]
  ruleIndex: number
  fieldKey: string
  opIndex: number
  op: ComputeFromOp
  isReadOnly: boolean
  isFirst: boolean
  isLast: boolean
  onCommitRules: (nextRules: DslRule[]) => void
}) => {
  const verb = isPlainObject(op)
    ? (Object.keys(op as Record<string, unknown>)[0] ??
      "add")
    : (op as string)
  const operand = isPlainObject(op)
    ? (Object.values(op as Record<string, number>)[0] ?? 0)
    : null
  const isBareOp = COMPUTE_FROM_OPS_BARE.includes(
    verb as (typeof COMPUTE_FROM_OPS_BARE)[number],
  )

  const [draftOperand, setDraftOperand] = useState(
    String(operand ?? 0),
  )

  return (
    <div className="flex items-center gap-1.5 mt-1">
      <Select
        className="w-40 font-mono"
        isDisabled={isReadOnly}
        // The op row is keyed by index, so a delete above it hands this
        // slot a different op. `Select` is uncontrolled, so without a key
        // the DOM would keep the departed op's verb.
        key={verb}
        label={`Operation ${opIndex + 1}`}
        onChange={(nextVerb) => {
          onCommitRules(
            setComputeFromOpVerb({
              rules,
              ruleIndex,
              fieldKey,
              opIndex,
              verb: nextVerb,
            }),
          )
        }}
        options={COMPUTE_FROM_OPS_ALL.map((opVerb) => ({
          label: opVerb,
          value: opVerb,
        }))}
        size="sm"
        value={verb}
      />
      {isBareOp ? (
        <span className="text-xs text-content-muted italic px-2">
          no operand
        </span>
      ) : (
        <input
          type="number"
          value={draftOperand}
          readOnly={isReadOnly}
          onChange={(event) => {
            setDraftOperand(event.target.value)
          }}
          onBlur={() => {
            const parsed =
              draftOperand === "" ? 0 : Number(draftOperand)
            onCommitRules(
              setComputeFromOpOperand({
                rules,
                ruleIndex,
                fieldKey,
                opIndex,
                operand: parsed,
              }),
            )
          }}
          className="w-24 bg-surface-sunken text-content-primary text-xs rounded px-2 py-1 border border-border-default focus:outline-none focus:border-border-focus font-mono"
        />
      )}
      {!isReadOnly && (
        <>
          <IconButton
            label="Move op up"
            intent="neutral"
            appearance="ghost"
            size="sm"
            isDisabled={isFirst}
            onClick={() => {
              onCommitRules(
                moveComputeFromOp({
                  rules,
                  ruleIndex,
                  fieldKey,
                  opIndex,
                  direction: -1,
                }),
              )
            }}
          >
            ↑
          </IconButton>
          <IconButton
            label="Move op down"
            intent="neutral"
            appearance="ghost"
            size="sm"
            isDisabled={isLast}
            onClick={() => {
              onCommitRules(
                moveComputeFromOp({
                  rules,
                  ruleIndex,
                  fieldKey,
                  opIndex,
                  direction: 1,
                }),
              )
            }}
          >
            ↓
          </IconButton>
          <IconButton
            label="Remove op"
            intent="danger"
            appearance="ghost"
            size="sm"
            onClick={() => {
              onCommitRules(
                removeComputeFromOp({
                  rules,
                  ruleIndex,
                  fieldKey,
                  opIndex,
                }),
              )
            }}
          >
            ✕
          </IconButton>
        </>
      )}
    </div>
  )
}
