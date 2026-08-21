import { Button } from "@charcuterie/ui"
import { useRef } from "react"
import { AssFieldPicker } from "./AssFieldPicker"
import {
  SCRIPT_INFO_FIELDS,
  STYLE_FIELDS,
} from "./assFields"
import { ComputeFromOpRow } from "./ComputeFromOpRow"
import { addComputeFromOp } from "./computeMutations"
import { ListboxPicker } from "./ListboxPicker"
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
    <div className="border border-border-subtle rounded px-2 py-1.5 bg-surface-raised mt-1">
      <div className="flex items-center gap-2">
        <span className="text-xs text-content-secondary">
          property
        </span>
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
        {/*
          10rem = 160px, measured: `scriptInfo` is the widest option
          and needs 146px. It sits on the trigger button, which is the
          control's outer box, chevron included.
        */}
        <ListboxPicker
          className="w-40 shrink-0 justify-between font-mono"
          hasChevron
          isDisabled={isReadOnly}
          key={scope}
          label="scope"
          onChange={(value) => {
            onCommitRules(
              setComputeFromField({
                rules,
                ruleIndex,
                fieldKey,
                propertyName: "scope",
                value,
              }),
            )
          }}
          options={[
            { label: "scriptInfo", value: "scriptInfo" },
            { label: "style", value: "style" },
          ]}
          value={scope}
        />
      </div>
      <div className="mt-1.5">
        <span className="text-xs uppercase tracking-wide text-content-secondary">
          ops
        </span>
        {ops.length === 0 ? (
          <p className="text-xs text-content-muted italic mt-1">
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
          <Button
            intent="neutral"
            appearance="ghost"
            size="sm"
            className="mt-1"
            onClick={() => {
              onCommitRules(
                addComputeFromOp({
                  rules,
                  ruleIndex,
                  fieldKey,
                }),
              )
            }}
          >
            + op
          </Button>
        )}
      </div>
    </div>
  )
}
