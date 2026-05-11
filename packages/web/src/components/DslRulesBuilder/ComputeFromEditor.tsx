import { useRef, useState } from "react"
import { isPlainObject } from "./clauseUtils"
import {
  addComputeFromOp,
  moveComputeFromOp,
  removeComputeFromOp,
  setComputeFromOpOperand,
  setComputeFromOpVerb,
} from "./computeMutations"
import { setComputeFromField } from "./styleMutations"
import {
  COMPUTE_FROM_OPS_ALL,
  COMPUTE_FROM_OPS_BARE,
  type ComputeFrom,
  type ComputeFromOp,
  type DslRule,
} from "./types"

type ComputeFromEditorProps = {
  rules: DslRule[]
  ruleIndex: number
  fieldKey: string
  computeFrom: ComputeFrom
  isReadOnly: boolean
  onCommitRules: (nextRules: DslRule[]) => void
}

const ComputeFromOpRow = ({
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

export const ComputeFromEditor = ({
  rules,
  ruleIndex,
  fieldKey,
  computeFrom,
  isReadOnly,
  onCommitRules,
}: ComputeFromEditorProps) => {
  const ops = Array.isArray(computeFrom.ops)
    ? computeFrom.ops
    : []
  const opIdsRef = useRef<string[]>([])
  while (opIdsRef.current.length < ops.length) {
    opIdsRef.current.push(crypto.randomUUID())
  }
  const [draftProperty, setDraftProperty] = useState(
    computeFrom.property ?? "",
  )

  return (
    <div className="border border-slate-700/60 rounded px-2 py-1.5 bg-slate-900/40 mt-1">
      <div className="flex items-center gap-2">
        <label
          htmlFor={`cfe-property-${ruleIndex}-${fieldKey}`}
          className="text-xs text-slate-400"
        >
          property
        </label>
        <input
          id={`cfe-property-${ruleIndex}-${fieldKey}`}
          type="text"
          value={draftProperty}
          placeholder="PlayResY"
          readOnly={isReadOnly}
          onChange={(event) => {
            setDraftProperty(event.target.value)
          }}
          onBlur={() => {
            onCommitRules(
              setComputeFromField({
                rules,
                ruleIndex,
                fieldKey,
                propertyName: "property",
                value: draftProperty,
              }),
            )
          }}
          className="flex-1 min-w-0 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"
        />
        <label
          htmlFor={`cfe-scope-${ruleIndex}-${fieldKey}`}
          className="text-xs text-slate-400"
        >
          scope
        </label>
        <select
          id={`cfe-scope-${ruleIndex}-${fieldKey}`}
          disabled={isReadOnly}
          value={computeFrom.scope ?? "scriptInfo"}
          onChange={(event) => {
            onCommitRules(
              setComputeFromField({
                rules,
                ruleIndex,
                fieldKey,
                propertyName: "scope",
                value: event.target.value,
              }),
            )
          }}
          className="text-xs bg-slate-700 text-slate-200 rounded px-1.5 py-1 border border-slate-600 focus:outline-none focus:border-blue-500"
        >
          <option value="scriptInfo">scriptInfo</option>
          <option value="style">style</option>
        </select>
      </div>
      <div className="mt-1.5">
        <span className="text-xs uppercase tracking-wide text-slate-400">
          ops
        </span>
        {ops.length === 0 ? (
          <p className="text-xs text-slate-500 italic mt-1">
            No ops yet.
          </p>
        ) : (
          ops.map((op, opIndex) => (
            <ComputeFromOpRow
              key={opIdsRef.current[opIndex]}
              rules={rules}
              ruleIndex={ruleIndex}
              fieldKey={fieldKey}
              opIndex={opIndex}
              op={op}
              isReadOnly={isReadOnly}
              isFirst={opIndex === 0}
              isLast={opIndex === ops.length - 1}
              onCommitRules={onCommitRules}
            />
          ))
        )}
        {!isReadOnly && (
          <button
            type="button"
            onClick={() => {
              onCommitRules(
                addComputeFromOp({
                  rules,
                  ruleIndex,
                  fieldKey,
                }),
              )
            }}
            className="text-xs text-slate-400 hover:text-blue-400 mt-1"
          >
            + op
          </button>
        )}
      </div>
    </div>
  )
}
