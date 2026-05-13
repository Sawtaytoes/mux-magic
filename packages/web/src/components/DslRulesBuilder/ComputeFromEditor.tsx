import { useRef } from "react"
import { AssFieldPicker } from "./AssFieldPicker"
import {
  SCRIPT_INFO_FIELDS,
  STYLE_FIELDS,
} from "./assFields"
import { ComputeFromOpRow } from "./ComputeFromOpRow"
import { addComputeFromOp } from "./computeMutations"
import { setComputeFromField } from "./styleMutations"
import type { ComputeFrom, DslRule } from "./types"

type ComputeFromEditorProps = {
  rules: DslRule[]
  ruleIndex: number
  fieldKey: string
  computeFrom: ComputeFrom
  isReadOnly: boolean
  onCommitRules: (nextRules: DslRule[]) => void
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

  const scope = computeFrom.scope ?? "scriptInfo"
  const propertyOptions =
    scope === "style" ? STYLE_FIELDS : SCRIPT_INFO_FIELDS

  return (
    <div className="border border-slate-700/60 rounded px-2 py-1.5 bg-slate-900/40 mt-1">
      <div className="flex items-center gap-2">
        <label
          htmlFor={`cfe-property-${ruleIndex}-${fieldKey}`}
          className="text-xs text-slate-400"
        >
          property
        </label>
        <AssFieldPicker
          label="property"
          value={computeFrom.property ?? ""}
          options={propertyOptions}
          isReadOnly={isReadOnly}
          inputId={`cfe-property-${ruleIndex}-${fieldKey}`}
          onChange={(newProperty) => {
            onCommitRules(
              setComputeFromField({
                rules,
                ruleIndex,
                fieldKey,
                propertyName: "property",
                value: newProperty,
              }),
            )
          }}
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
          value={scope}
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
