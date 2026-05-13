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
      <select
        disabled={isReadOnly}
        value={verb}
        onChange={(event) => {
          onCommitRules(
            setComputeFromOpVerb({
              rules,
              ruleIndex,
              fieldKey,
              opIndex,
              verb: event.target.value,
            }),
          )
        }}
        className="text-xs bg-slate-700 text-slate-200 rounded px-1.5 py-1 border border-slate-600 focus:outline-none focus:border-blue-500"
      >
        {COMPUTE_FROM_OPS_ALL.map((opVerb) => (
          <option key={opVerb} value={opVerb}>
            {opVerb}
          </option>
        ))}
      </select>
      {isBareOp ? (
        <span className="text-xs text-slate-500 italic px-2">
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
          className="w-24 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"
        />
      )}
      {!isReadOnly && (
        <>
          <button
            type="button"
            disabled={isFirst}
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
            className="text-xs text-slate-400 hover:text-slate-100 disabled:opacity-30 px-1"
          >
            ↑
          </button>
          <button
            type="button"
            disabled={isLast}
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
            className="text-xs text-slate-400 hover:text-slate-100 disabled:opacity-30 px-1"
          >
            ↓
          </button>
          <button
            type="button"
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
            className="text-xs text-slate-500 hover:text-red-400 px-1.5"
          >
            ✕
          </button>
        </>
      )}
    </div>
  )
}
