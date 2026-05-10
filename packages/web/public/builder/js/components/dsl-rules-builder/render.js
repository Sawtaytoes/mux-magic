import { esc } from "../../step-renderer.js"
import {
  isPlainObject,
  isRefBody,
  normalizeWhenClause,
} from "./clause-utils.js"
import {
  APPLY_IF_CLAUSE_NAMES,
  COMPARATOR_VERBS,
  COMPUTE_FROM_OPS_ALL,
  COMPUTE_FROM_OPS_BARE,
  DEFAULT_RULES_PREVIEW,
  RULE_TYPES,
  WHEN_CLAUSE_NAMES,
} from "./constants.js"

// Keys of all open <details> inside DSL rule builders. Module-level so the
// Set survives renderAll calls; DOM is queried before each render to stay
// authoritative (ontoggle can fire spuriously on insertion/removal).
const openDetailsKeys = new Set()

export function onDetailsToggle(detailsKey, isOpen) {
  if (isOpen) {
    openDetailsKeys.add(detailsKey)
  } else {
    openDetailsKeys.delete(detailsKey)
  }
}

// ─── When clause rendering ────────────────────────────────────────────────────

function renderPredicateOptions({
  predicates,
  selectedRefName,
}) {
  const blank = `<option value=""${selectedRefName ? "" : " selected"}>— inline —</option>`
  const options = Object.keys(predicates)
    .map(
      (predicateName) =>
        `<option value="${esc(predicateName)}"${selectedRefName === predicateName ? " selected" : ""}>$ref: ${esc(predicateName)}</option>`,
    )
    .join("")
  return blank + options
}

function renderKeyValueRow({
  stepId,
  ruleIndex,
  clauseName,
  slot,
  entryKey,
  entryValue,
  isReadOnly,
}) {
  const readOnlyAttribute = isReadOnly ? "readonly" : ""
  const removeButton = isReadOnly
    ? ""
    : `<button type="button"
        onclick="dslRules.removeWhenEntry({stepId:'${stepId}',ruleIndex:${ruleIndex},clauseName:'${clauseName}',slot:'${slot}',entryKey:${JSON.stringify(entryKey).replace(/"/g, "&quot;")}})"
        class="text-xs text-slate-500 hover:text-red-400 px-1.5">✕</button>`
  const onKeyChange = isReadOnly
    ? ""
    : `onchange="dslRules.setWhenEntryKey({stepId:'${stepId}',ruleIndex:${ruleIndex},clauseName:'${clauseName}',slot:'${slot}',oldKey:${JSON.stringify(entryKey).replace(/"/g, "&quot;")},newKey:this.value})"`
  const onValueInput = isReadOnly
    ? ""
    : `oninput="dslRules.setWhenEntryValue({stepId:'${stepId}',ruleIndex:${ruleIndex},clauseName:'${clauseName}',slot:'${slot}',entryKey:${JSON.stringify(entryKey).replace(/"/g, "&quot;")},value:this.value})"`
  return `<div class="flex items-center gap-1.5 mt-1">
    <input type="text" value="${esc(entryKey)}" placeholder="key" ${readOnlyAttribute} ${onKeyChange}
      class="flex-1 min-w-0 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" />
    <span class="text-slate-500 text-xs">=</span>
    <input type="text" value="${esc(entryValue)}" placeholder="value" ${readOnlyAttribute} ${onValueInput}
      class="flex-1 min-w-0 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" />
    ${removeButton}
  </div>`
}

function renderWhenSlot({
  stepId,
  ruleIndex,
  clauseName,
  slot,
  slotValue,
  predicates,
  isReadOnly,
}) {
  const isRef = isRefBody(slotValue)
  const refName = isRef ? slotValue.$ref : ""
  const slotLabel =
    slot === "matches" ? "Matches" : "Excludes"
  const refDropdown = `<select ${isReadOnly ? "disabled" : ""}
    onchange="dslRules.setWhenClauseRef({stepId:'${stepId}',ruleIndex:${ruleIndex},clauseName:'${clauseName}',slot:'${slot}',refName:this.value})"
    class="text-xs bg-slate-700 text-slate-200 rounded px-1.5 py-0.5 border border-slate-600 focus:outline-none focus:border-blue-500">
    ${renderPredicateOptions({ predicates, selectedRefName: refName })}
  </select>`
  const slotBody =
    isPlainObject(slotValue) && !isRef ? slotValue : {}
  const entryRows = Object.entries(slotBody)
    .map(([entryKey, entryValue]) =>
      renderKeyValueRow({
        stepId,
        ruleIndex,
        clauseName,
        slot,
        entryKey,
        entryValue,
        isReadOnly,
      }),
    )
    .join("")
  const addButton = isReadOnly
    ? ""
    : `<button type="button"
        onclick="dslRules.addWhenEntry({stepId:'${stepId}',ruleIndex:${ruleIndex},clauseName:'${clauseName}',slot:'${slot}'})"
        class="text-xs text-slate-400 hover:text-blue-400 mt-1">+ entry</button>`
  return `<div class="border border-slate-700/60 rounded px-2 py-1.5 bg-slate-900/40">
    <div class="flex items-center gap-2">
      <span class="text-xs uppercase tracking-wide text-slate-400">${slotLabel}</span>
      ${refDropdown}
    </div>
    ${isRef ? "" : entryRows}
    ${isRef ? "" : addButton}
  </div>`
}

function renderWhenClause({
  stepId,
  ruleIndex,
  clauseName,
  clauseValue,
  predicates,
  isReadOnly,
}) {
  const canonical = normalizeWhenClause(clauseValue)
  const removeClauseButton = isReadOnly
    ? ""
    : `<button type="button"
        onclick="dslRules.removeWhenClause({stepId:'${stepId}',ruleIndex:${ruleIndex},clauseName:'${clauseName}'})"
        class="text-xs text-slate-500 hover:text-red-400">✕ Remove clause</button>`
  return `<div class="border border-slate-700 rounded px-2 py-2 mt-2 bg-slate-900/30">
    <div class="flex items-center justify-between mb-1">
      <span class="text-xs font-mono text-blue-300">${esc(clauseName)}</span>
      ${removeClauseButton}
    </div>
    ${renderWhenSlot({ stepId, ruleIndex, clauseName, slot: "matches", slotValue: canonical.matches, predicates, isReadOnly })}
    <div class="mt-1.5">
      ${renderWhenSlot({ stepId, ruleIndex, clauseName, slot: "excludes", slotValue: canonical.excludes, predicates, isReadOnly })}
    </div>
  </div>`
}

function renderWhenBuilder({
  stepId,
  ruleIndex,
  whenValue,
  predicates,
  isReadOnly,
}) {
  const when = isPlainObject(whenValue) ? whenValue : {}
  const usedClauses = new Set(Object.keys(when))
  const availableClauses = WHEN_CLAUSE_NAMES.filter(
    (clauseName) => !usedClauses.has(clauseName),
  )
  const clauseRows = WHEN_CLAUSE_NAMES.filter(
    (clauseName) => usedClauses.has(clauseName),
  )
    .map((clauseName) =>
      renderWhenClause({
        stepId,
        ruleIndex,
        clauseName,
        clauseValue: when[clauseName],
        predicates,
        isReadOnly,
      }),
    )
    .join("")
  const addClauseDropdown =
    isReadOnly || availableClauses.length === 0
      ? ""
      : `<select ${availableClauses.length === 0 ? "disabled" : ""}
        onchange="dslRules.addWhenClause({stepId:'${stepId}',ruleIndex:${ruleIndex},clauseName:this.value}); this.value=''"
        class="text-xs bg-slate-700 text-slate-200 rounded px-1.5 py-0.5 border border-slate-600 focus:outline-none focus:border-blue-500 mt-2">
        <option value="">+ Add clause…</option>
        ${availableClauses.map((clauseName) => `<option value="${clauseName}">${clauseName}</option>`).join("")}
      </select>`
  const detailsKey = `${stepId}:when:${ruleIndex}`
  const openAttr =
    !isReadOnly && openDetailsKeys.has(detailsKey)
      ? " open"
      : ""
  const toggleAttr = isReadOnly
    ? ""
    : `data-details-key="${detailsKey}" ontoggle="dslRules.onDetailsToggle(this.dataset.detailsKey,this.open)"`
  return `<details${openAttr} class="mt-2 border border-slate-700/60 rounded" ${toggleAttr}>
    <summary class="cursor-pointer text-xs text-slate-400 px-2 py-1 select-none">When (advanced — leave empty to always fire)</summary>
    <div class="px-2 py-1.5">
      ${clauseRows || '<p class="text-xs text-slate-500 italic">No clauses. Rule fires on every batch.</p>'}
      ${addClauseDropdown}
    </div>
  </details>`
}

// ─── applyIf rendering ────────────────────────────────────────────────────────

function renderApplyIfEntryRow({
  stepId,
  ruleIndex,
  clauseName,
  entryKey,
  entryValue,
  isReadOnly,
}) {
  const readOnlyAttribute = isReadOnly ? "readonly" : ""
  const verb = isPlainObject(entryValue)
    ? Object.keys(entryValue)[0]
    : "eq"
  const operand = isPlainObject(entryValue)
    ? entryValue[verb]
    : 0
  const removeButton = isReadOnly
    ? ""
    : `<button type="button"
        onclick="dslRules.removeApplyIfEntry({stepId:'${stepId}',ruleIndex:${ruleIndex},clauseName:'${clauseName}',entryKey:${JSON.stringify(entryKey).replace(/"/g, "&quot;")}})"
        class="text-xs text-slate-500 hover:text-red-400 px-1.5">✕</button>`
  const onKeyChange = isReadOnly
    ? ""
    : `onchange="dslRules.setApplyIfEntryKey({stepId:'${stepId}',ruleIndex:${ruleIndex},clauseName:'${clauseName}',oldKey:${JSON.stringify(entryKey).replace(/"/g, "&quot;")},newKey:this.value})"`
  const onVerbChange = isReadOnly
    ? ""
    : `onchange="dslRules.setApplyIfEntryComparator({stepId:'${stepId}',ruleIndex:${ruleIndex},clauseName:'${clauseName}',entryKey:${JSON.stringify(entryKey).replace(/"/g, "&quot;")},verb:this.value})"`
  const onOperandInput = isReadOnly
    ? ""
    : `oninput="dslRules.setApplyIfEntryOperand({stepId:'${stepId}',ruleIndex:${ruleIndex},clauseName:'${clauseName}',entryKey:${JSON.stringify(entryKey).replace(/"/g, "&quot;")},operand:this.value===''?0:Number(this.value)})"`
  return `<div class="flex items-center gap-1.5 mt-1">
    <input type="text" value="${esc(entryKey)}" placeholder="Field" ${readOnlyAttribute} ${onKeyChange}
      class="flex-1 min-w-0 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" />
    <select ${readOnlyAttribute ? "disabled" : ""} ${onVerbChange}
      class="text-xs bg-slate-700 text-slate-200 rounded px-1.5 py-1 border border-slate-600 focus:outline-none focus:border-blue-500">
      ${COMPARATOR_VERBS.map((comparatorVerb) => `<option value="${comparatorVerb}"${comparatorVerb === verb ? " selected" : ""}>${comparatorVerb}</option>`).join("")}
    </select>
    <input type="number" value="${esc(operand)}" ${readOnlyAttribute} ${onOperandInput}
      class="w-24 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" />
    ${removeButton}
  </div>`
}

function renderApplyIfClause({
  stepId,
  ruleIndex,
  clauseName,
  clauseValue,
  isReadOnly,
}) {
  const clause = isPlainObject(clauseValue)
    ? clauseValue
    : {}
  const entryRows = Object.entries(clause)
    .map(([entryKey, entryValue]) =>
      renderApplyIfEntryRow({
        stepId,
        ruleIndex,
        clauseName,
        entryKey,
        entryValue,
        isReadOnly,
      }),
    )
    .join("")
  const removeClauseButton = isReadOnly
    ? ""
    : `<button type="button"
        onclick="dslRules.removeApplyIfClause({stepId:'${stepId}',ruleIndex:${ruleIndex},clauseName:'${clauseName}'})"
        class="text-xs text-slate-500 hover:text-red-400">✕ Remove clause</button>`
  const addEntryButton = isReadOnly
    ? ""
    : `<button type="button"
        onclick="dslRules.addApplyIfEntry({stepId:'${stepId}',ruleIndex:${ruleIndex},clauseName:'${clauseName}'})"
        class="text-xs text-slate-400 hover:text-blue-400 mt-1">+ entry</button>`
  return `<div class="border border-slate-700 rounded px-2 py-2 mt-2 bg-slate-900/30">
    <div class="flex items-center justify-between mb-1">
      <span class="text-xs font-mono text-blue-300">${esc(clauseName)}</span>
      ${removeClauseButton}
    </div>
    ${entryRows}
    ${addEntryButton}
  </div>`
}

function renderApplyIfBuilder({
  stepId,
  ruleIndex,
  applyIfValue,
  isReadOnly,
}) {
  const applyIf = isPlainObject(applyIfValue)
    ? applyIfValue
    : {}
  const usedClauses = new Set(Object.keys(applyIf))
  const availableClauses = APPLY_IF_CLAUSE_NAMES.filter(
    (clauseName) => !usedClauses.has(clauseName),
  )
  const clauseRows = APPLY_IF_CLAUSE_NAMES.filter(
    (clauseName) => usedClauses.has(clauseName),
  )
    .map((clauseName) =>
      renderApplyIfClause({
        stepId,
        ruleIndex,
        clauseName,
        clauseValue: applyIf[clauseName],
        isReadOnly,
      }),
    )
    .join("")
  const addClauseDropdown =
    isReadOnly || availableClauses.length === 0
      ? ""
      : `<select onchange="dslRules.addApplyIfClause({stepId:'${stepId}',ruleIndex:${ruleIndex},clauseName:this.value}); this.value=''"
        class="text-xs bg-slate-700 text-slate-200 rounded px-1.5 py-0.5 border border-slate-600 focus:outline-none focus:border-blue-500 mt-2">
        <option value="">+ Add clause…</option>
        ${availableClauses.map((clauseName) => `<option value="${clauseName}">${clauseName}</option>`).join("")}
      </select>`
  const applyIfKey = `${stepId}:applyif:${ruleIndex}`
  const applyIfOpenAttr =
    !isReadOnly && openDetailsKeys.has(applyIfKey)
      ? " open"
      : ""
  const applyIfToggleAttr = isReadOnly
    ? ""
    : `data-details-key="${applyIfKey}" ontoggle="dslRules.onDetailsToggle(this.dataset.detailsKey,this.open)"`
  return `<details${applyIfOpenAttr} class="mt-2 border border-slate-700/60 rounded" ${applyIfToggleAttr}>
    <summary class="cursor-pointer text-xs text-slate-400 px-2 py-1 select-none">applyIf (per-style filter — leave empty to apply to all non-ignored styles)</summary>
    <div class="px-2 py-1.5">
      ${clauseRows || '<p class="text-xs text-slate-500 italic">No clauses. Applies to all non-ignored styles.</p>'}
      ${addClauseDropdown}
    </div>
  </details>`
}

// ─── computeFrom rendering ────────────────────────────────────────────────────

function renderComputeFromOpRow({
  stepId,
  ruleIndex,
  fieldKey,
  opIndex,
  op,
  isReadOnly,
  isFirst,
  isLast,
}) {
  const verb = isPlainObject(op) ? Object.keys(op)[0] : op
  const operand = isPlainObject(op)
    ? Object.values(op)[0]
    : null
  const isBareOp = COMPUTE_FROM_OPS_BARE.includes(verb)
  const fieldKeyJson = JSON.stringify(fieldKey).replace(
    /"/g,
    "&quot;",
  )
  const verbDropdown = `<select ${isReadOnly ? "disabled" : ""}
    onchange="dslRules.setComputeFromOpVerb({stepId:'${stepId}',ruleIndex:${ruleIndex},fieldKey:${fieldKeyJson},opIndex:${opIndex},verb:this.value})"
    class="text-xs bg-slate-700 text-slate-200 rounded px-1.5 py-1 border border-slate-600 focus:outline-none focus:border-blue-500">
    ${COMPUTE_FROM_OPS_ALL.map((opVerb) => `<option value="${opVerb}"${opVerb === verb ? " selected" : ""}>${opVerb}</option>`).join("")}
  </select>`
  const operandInput = isBareOp
    ? '<span class="text-xs text-slate-500 italic px-2">no operand</span>'
    : `<input type="number" value="${esc(operand ?? 0)}" ${isReadOnly ? "readonly" : ""}
        oninput="dslRules.setComputeFromOpOperand({stepId:'${stepId}',ruleIndex:${ruleIndex},fieldKey:${fieldKeyJson},opIndex:${opIndex},operand:this.value===''?0:Number(this.value)})"
        class="w-24 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" />`
  const moveButtons = isReadOnly
    ? ""
    : `<button type="button" ${isFirst ? "disabled" : ""}
        onclick="dslRules.moveComputeFromOp({stepId:'${stepId}',ruleIndex:${ruleIndex},fieldKey:${fieldKeyJson},opIndex:${opIndex},direction:-1})"
        class="text-xs text-slate-400 hover:text-slate-100 disabled:opacity-30 px-1">↑</button>
      <button type="button" ${isLast ? "disabled" : ""}
        onclick="dslRules.moveComputeFromOp({stepId:'${stepId}',ruleIndex:${ruleIndex},fieldKey:${fieldKeyJson},opIndex:${opIndex},direction:1})"
        class="text-xs text-slate-400 hover:text-slate-100 disabled:opacity-30 px-1">↓</button>
      <button type="button"
        onclick="dslRules.removeComputeFromOp({stepId:'${stepId}',ruleIndex:${ruleIndex},fieldKey:${fieldKeyJson},opIndex:${opIndex}})"
        class="text-xs text-slate-500 hover:text-red-400 px-1.5">✕</button>`
  return `<div class="flex items-center gap-1.5 mt-1">
    ${verbDropdown}
    ${operandInput}
    ${moveButtons}
  </div>`
}

function renderComputeFromEditor({
  stepId,
  ruleIndex,
  fieldKey,
  computeFrom,
  isReadOnly,
}) {
  const property = computeFrom?.property ?? ""
  const scope = computeFrom?.scope ?? "scriptInfo"
  const ops = Array.isArray(computeFrom?.ops)
    ? computeFrom.ops
    : []
  const fieldKeyJson = JSON.stringify(fieldKey).replace(
    /"/g,
    "&quot;",
  )
  const opRows = ops
    .map((op, opIndex) =>
      renderComputeFromOpRow({
        stepId,
        ruleIndex,
        fieldKey,
        opIndex,
        op,
        isReadOnly,
        isFirst: opIndex === 0,
        isLast: opIndex === ops.length - 1,
      }),
    )
    .join("")
  const addOpButton = isReadOnly
    ? ""
    : `<button type="button"
        onclick="dslRules.addComputeFromOp({stepId:'${stepId}',ruleIndex:${ruleIndex},fieldKey:${fieldKeyJson}})"
        class="text-xs text-slate-400 hover:text-blue-400 mt-1">+ op</button>`
  const onPropertyInput = isReadOnly
    ? ""
    : `oninput="dslRules.setComputeFromField({stepId:'${stepId}',ruleIndex:${ruleIndex},fieldKey:${fieldKeyJson},propertyName:'property',value:this.value,isLiveEdit:true})"`
  const onScopeChange = isReadOnly
    ? ""
    : `onchange="dslRules.setComputeFromField({stepId:'${stepId}',ruleIndex:${ruleIndex},fieldKey:${fieldKeyJson},propertyName:'scope',value:this.value})"`
  return `<div class="border border-slate-700/60 rounded px-2 py-1.5 bg-slate-900/40 mt-1">
    <div class="flex items-center gap-2">
      <label class="text-xs text-slate-400">property</label>
      <input type="text" value="${esc(property)}" placeholder="PlayResY" ${isReadOnly ? "readonly" : ""} ${onPropertyInput}
        class="flex-1 min-w-0 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" />
      <label class="text-xs text-slate-400">scope</label>
      <select ${isReadOnly ? "disabled" : ""} ${onScopeChange}
        class="text-xs bg-slate-700 text-slate-200 rounded px-1.5 py-1 border border-slate-600 focus:outline-none focus:border-blue-500">
        <option value="scriptInfo"${scope === "scriptInfo" ? " selected" : ""}>scriptInfo</option>
        <option value="style"${scope === "style" ? " selected" : ""}>style</option>
      </select>
    </div>
    <div class="mt-1.5">
      <span class="text-xs uppercase tracking-wide text-slate-400">ops</span>
      ${opRows || '<p class="text-xs text-slate-500 italic mt-1">No ops yet.</p>'}
      ${addOpButton}
    </div>
  </div>`
}

// ─── Style field rendering ────────────────────────────────────────────────────

function renderStyleFieldRow({
  stepId,
  ruleIndex,
  fieldKey,
  fieldValue,
  isReadOnly,
}) {
  const fieldKeyJson = JSON.stringify(fieldKey).replace(
    /"/g,
    "&quot;",
  )
  const isComputed =
    isPlainObject(fieldValue) &&
    isPlainObject(fieldValue.computeFrom)
  const literalValue =
    typeof fieldValue === "string" ? fieldValue : ""
  const onKeyChange = isReadOnly
    ? ""
    : `onchange="dslRules.renameStyleField({stepId:'${stepId}',ruleIndex:${ruleIndex},oldKey:${fieldKeyJson},newKey:this.value})"`
  const onLiteralInput = isReadOnly
    ? ""
    : `oninput="dslRules.setStyleFieldLiteralValue({stepId:'${stepId}',ruleIndex:${ruleIndex},fieldKey:${fieldKeyJson},value:this.value})"`
  const onComputedToggle = isReadOnly
    ? ""
    : `onchange="dslRules.setStyleFieldComputedToggle({stepId:'${stepId}',ruleIndex:${ruleIndex},fieldKey:${fieldKeyJson},isComputed:this.checked})"`
  const removeButton = isReadOnly
    ? ""
    : `<button type="button"
        onclick="dslRules.removeStyleField({stepId:'${stepId}',ruleIndex:${ruleIndex},fieldKey:${fieldKeyJson}})"
        class="text-xs text-slate-500 hover:text-red-400 px-1.5">✕</button>`
  return `<div class="border border-slate-700/40 rounded px-2 py-1.5 mt-1 bg-slate-900/20">
    <div class="flex items-center gap-1.5">
      <input type="text" value="${esc(fieldKey)}" placeholder="MarginV" ${isReadOnly ? "readonly" : ""} ${onKeyChange}
        class="w-32 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" />
      <span class="text-slate-500 text-xs">=</span>
      ${
        isComputed
          ? '<span class="flex-1 text-xs text-slate-400 italic">computed from metadata ↓</span>'
          : `<input type="text" value="${esc(literalValue)}" placeholder="value" ${isReadOnly ? "readonly" : ""} ${onLiteralInput}
            class="flex-1 min-w-0 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" />`
      }
      <label class="flex items-center gap-1 text-xs text-slate-400 cursor-pointer">
        <input type="checkbox" ${isComputed ? "checked" : ""} ${isReadOnly ? "disabled" : ""} ${onComputedToggle}
          class="w-3.5 h-3.5 rounded bg-slate-700 border-slate-500 accent-blue-500 cursor-pointer" />
        computed
      </label>
      ${removeButton}
    </div>
    ${isComputed ? renderComputeFromEditor({ stepId, ruleIndex, fieldKey, computeFrom: fieldValue.computeFrom, isReadOnly }) : ""}
  </div>`
}

// ─── Rule card rendering ──────────────────────────────────────────────────────

function renderRuleBody({
  stepId,
  ruleIndex,
  rule,
  predicates,
  isReadOnly,
}) {
  if (rule.type === "setScriptInfo") {
    const onKeyInput = isReadOnly
      ? ""
      : `oninput="dslRules.setScriptInfoField({stepId:'${stepId}',ruleIndex:${ruleIndex},fieldName:'key',value:this.value})"`
    const onValueInput = isReadOnly
      ? ""
      : `oninput="dslRules.setScriptInfoField({stepId:'${stepId}',ruleIndex:${ruleIndex},fieldName:'value',value:this.value})"`
    return `<div class="grid grid-cols-2 gap-2">
      <div>
        <label class="block text-xs text-slate-400 mb-1">Key</label>
        <input type="text" value="${esc(rule.key ?? "")}" placeholder="ScriptType" ${isReadOnly ? "readonly" : ""} ${onKeyInput}
          class="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" />
      </div>
      <div>
        <label class="block text-xs text-slate-400 mb-1">Value</label>
        <input type="text" value="${esc(rule.value ?? "")}" placeholder="v4.00+" ${isReadOnly ? "readonly" : ""} ${onValueInput}
          class="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" />
      </div>
    </div>
    ${renderWhenBuilder({ stepId, ruleIndex, whenValue: rule.when, predicates, isReadOnly })}`
  }

  if (rule.type === "scaleResolution") {
    const fromGroup = isPlainObject(rule.from)
      ? rule.from
      : { width: 0, height: 0 }
    const toGroup = isPlainObject(rule.to)
      ? rule.to
      : { width: 0, height: 0 }
    const onDimensionInput = (group, dimension) =>
      isReadOnly
        ? ""
        : `oninput="dslRules.setScaleResolutionDimension({stepId:'${stepId}',ruleIndex:${ruleIndex},group:'${group}',dimension:'${dimension}',value:this.value===''?0:Number(this.value)})"`
    const onFlagChange = isReadOnly
      ? ""
      : `onchange="dslRules.setScaleResolutionFlag({stepId:'${stepId}',ruleIndex:${ruleIndex},flagName:'hasScaledBorderAndShadow',value:this.checked})"`
    const isHasScaledBorderAndShadow =
      rule.hasScaledBorderAndShadow !== false
    return `<div class="grid grid-cols-2 gap-2">
      <div>
        <label class="block text-xs text-slate-400 mb-1">From width</label>
        <input type="number" aria-label="From width" value="${esc(fromGroup.width ?? 0)}" ${isReadOnly ? "readonly" : ""} ${onDimensionInput("from", "width")}
          class="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" />
      </div>
      <div>
        <label class="block text-xs text-slate-400 mb-1">From height</label>
        <input type="number" aria-label="From height" value="${esc(fromGroup.height ?? 0)}" ${isReadOnly ? "readonly" : ""} ${onDimensionInput("from", "height")}
          class="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" />
      </div>
      <div>
        <label class="block text-xs text-slate-400 mb-1">To width</label>
        <input type="number" aria-label="To width" value="${esc(toGroup.width ?? 0)}" ${isReadOnly ? "readonly" : ""} ${onDimensionInput("to", "width")}
          class="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" />
      </div>
      <div>
        <label class="block text-xs text-slate-400 mb-1">To height</label>
        <input type="number" aria-label="To height" value="${esc(toGroup.height ?? 0)}" ${isReadOnly ? "readonly" : ""} ${onDimensionInput("to", "height")}
          class="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" />
      </div>
    </div>
    <label class="flex items-center gap-2 mt-2 cursor-pointer text-xs text-slate-300">
      <input type="checkbox" ${isHasScaledBorderAndShadow ? "checked" : ""} ${isReadOnly ? "disabled" : ""} ${onFlagChange}
        class="w-3.5 h-3.5 rounded bg-slate-700 border-slate-500 accent-blue-500 cursor-pointer" />
      hasScaledBorderAndShadow
    </label>
    ${renderWhenBuilder({ stepId, ruleIndex, whenValue: rule.when, predicates, isReadOnly })}`
  }

  if (rule.type === "setStyleFields") {
    const fields = isPlainObject(rule.fields)
      ? rule.fields
      : {}
    const fieldRows = Object.entries(fields)
      .map(([fieldKey, fieldValue]) =>
        renderStyleFieldRow({
          stepId,
          ruleIndex,
          fieldKey,
          fieldValue,
          isReadOnly,
        }),
      )
      .join("")
    const addFieldButton = isReadOnly
      ? ""
      : `<button type="button"
          onclick="dslRules.addStyleField({stepId:'${stepId}',ruleIndex:${ruleIndex}})"
          class="text-xs text-slate-400 hover:text-blue-400 mt-1">+ field</button>`
    const onIgnoredRegexInput = isReadOnly
      ? ""
      : `oninput="dslRules.setIgnoredStyleNamesRegex({stepId:'${stepId}',ruleIndex:${ruleIndex},value:this.value})"`
    return `<div>
      <label class="block text-xs text-slate-400 mb-1">Fields</label>
      ${fieldRows || '<p class="text-xs text-slate-500 italic">No fields yet.</p>'}
      ${addFieldButton}
    </div>
    <div class="mt-2">
      <label class="block text-xs text-slate-400 mb-1">ignoredStyleNamesRegexString</label>
      <input type="text" value="${esc(rule.ignoredStyleNamesRegexString ?? "")}" placeholder="signs?|op|ed" ${isReadOnly ? "readonly" : ""} ${onIgnoredRegexInput}
        class="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" />
    </div>
    ${renderApplyIfBuilder({ stepId, ruleIndex, applyIfValue: rule.applyIf, isReadOnly })}
    ${renderWhenBuilder({ stepId, ruleIndex, whenValue: rule.when, predicates, isReadOnly })}`
  }

  return `<p class="text-xs text-red-400">Unknown rule type: ${esc(rule.type)}</p>`
}

function renderRuleCard({
  stepId,
  ruleIndex,
  rule,
  predicates,
  isReadOnly,
  totalRules,
}) {
  const ruleType = rule.type ?? "setScriptInfo"
  const onTypeChange = isReadOnly
    ? ""
    : `onchange="dslRules.changeRuleType({stepId:'${stepId}',ruleIndex:${ruleIndex},ruleType:this.value})"`
  const moveUpButton =
    isReadOnly || ruleIndex === 0
      ? '<button type="button" disabled class="text-xs text-slate-600 px-1 opacity-30">↑</button>'
      : `<button type="button"
        onclick="dslRules.moveRule({stepId:'${stepId}',ruleIndex:${ruleIndex},direction:-1})"
        class="text-xs text-slate-400 hover:text-slate-100 px-1">↑</button>`
  const moveDownButton =
    isReadOnly || ruleIndex >= totalRules - 1
      ? '<button type="button" disabled class="text-xs text-slate-600 px-1 opacity-30">↓</button>'
      : `<button type="button"
        onclick="dslRules.moveRule({stepId:'${stepId}',ruleIndex:${ruleIndex},direction:1})"
        class="text-xs text-slate-400 hover:text-slate-100 px-1">↓</button>`
  const removeButton = isReadOnly
    ? ""
    : `<button type="button"
        onclick="dslRules.removeRule({stepId:'${stepId}',ruleIndex:${ruleIndex}})"
        class="text-xs text-slate-500 hover:text-red-400 px-1.5">✕</button>`
  const headerBackground = isReadOnly
    ? "bg-slate-900/30"
    : "bg-slate-800/60"
  const cardBackground = isReadOnly
    ? "bg-slate-900/20 border-slate-700/40"
    : "bg-slate-800/40 border-slate-700"
  const readOnlyBadge = isReadOnly
    ? '<span class="text-[10px] uppercase tracking-wide font-semibold text-amber-300 bg-amber-950/60 border border-amber-700/50 rounded px-1.5 py-0.5">default</span>'
    : ""
  return `<div class="${cardBackground} border rounded px-2 py-2 mt-2">
    <div class="${headerBackground} -mx-2 -mt-2 px-2 py-1 mb-2 flex items-center gap-2 border-b border-slate-700/60 rounded-t">
      <span class="text-xs font-mono text-slate-500">${ruleIndex + 1}.</span>
      <select ${isReadOnly ? "disabled" : ""} ${onTypeChange}
        class="text-xs bg-slate-700 text-slate-200 rounded px-1.5 py-1 border border-slate-600 focus:outline-none focus:border-blue-500">
        ${RULE_TYPES.map((type) => `<option value="${type}"${type === ruleType ? " selected" : ""}>${type}</option>`).join("")}
      </select>
      ${readOnlyBadge}
      <span class="flex-1"></span>
      ${moveUpButton}
      ${moveDownButton}
      ${removeButton}
    </div>
    ${renderRuleBody({ stepId, ruleIndex, rule, predicates, isReadOnly })}
  </div>`
}

function renderInsertRuleStrip({ stepId, insertIndex }) {
  return `<div class="flex items-center gap-1 mt-1">
    <div class="flex-1 h-px bg-slate-700/40"></div>
    <button type="button"
      onclick="dslRules.addRule({stepId:'${stepId}',ruleType:'setScriptInfo',insertIndex:${insertIndex}})"
      class="text-[10px] text-slate-500 hover:text-blue-400 px-1.5 py-0.5 rounded border border-transparent hover:border-blue-500/40">+ setScriptInfo</button>
    <button type="button"
      onclick="dslRules.addRule({stepId:'${stepId}',ruleType:'scaleResolution',insertIndex:${insertIndex}})"
      class="text-[10px] text-slate-500 hover:text-blue-400 px-1.5 py-0.5 rounded border border-transparent hover:border-blue-500/40">+ scaleResolution</button>
    <button type="button"
      onclick="dslRules.addRule({stepId:'${stepId}',ruleType:'setStyleFields',insertIndex:${insertIndex}})"
      class="text-[10px] text-slate-500 hover:text-blue-400 px-1.5 py-0.5 rounded border border-transparent hover:border-blue-500/40">+ setStyleFields</button>
    <div class="flex-1 h-px bg-slate-700/40"></div>
  </div>`
}

function renderPredicatesManager({ stepId, predicates }) {
  const predicateNames = Object.keys(predicates)
  const renderEntry = ({
    predicateName,
    entryKey,
    entryValue,
  }) => {
    const entryKeyJson = JSON.stringify(entryKey).replace(
      /"/g,
      "&quot;",
    )
    const onKeyChange = `onchange="dslRules.setPredicateEntryKey({stepId:'${stepId}',predicateName:${JSON.stringify(predicateName).replace(/"/g, "&quot;")},oldKey:${entryKeyJson},newKey:this.value})"`
    const onValueInput = `oninput="dslRules.setPredicateEntryValue({stepId:'${stepId}',predicateName:${JSON.stringify(predicateName).replace(/"/g, "&quot;")},entryKey:${entryKeyJson},value:this.value})"`
    const onRemove = `onclick="dslRules.removePredicateEntry({stepId:'${stepId}',predicateName:${JSON.stringify(predicateName).replace(/"/g, "&quot;")},entryKey:${entryKeyJson}})"`
    return `<div class="flex items-center gap-1.5 mt-1">
      <input type="text" value="${esc(entryKey)}" placeholder="key" ${onKeyChange}
        class="flex-1 min-w-0 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" />
      <span class="text-slate-500 text-xs">=</span>
      <input type="text" value="${esc(entryValue)}" placeholder="value" ${onValueInput}
        class="flex-1 min-w-0 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" />
      <button type="button" ${onRemove} class="text-xs text-slate-500 hover:text-red-400 px-1.5">✕</button>
    </div>`
  }
  const predicateCards = predicateNames
    .map((predicateName) => {
      const body = isPlainObject(predicates[predicateName])
        ? predicates[predicateName]
        : {}
      const entryRows = Object.entries(body)
        .map(([entryKey, entryValue]) =>
          renderEntry({
            predicateName,
            entryKey,
            entryValue,
          }),
        )
        .join("")
      const onNameChange = `onchange="dslRules.renamePredicate({stepId:'${stepId}',oldName:${JSON.stringify(predicateName).replace(/"/g, "&quot;")},newName:this.value})"`
      const onRemove = `onclick="dslRules.removePredicate({stepId:'${stepId}',predicateName:${JSON.stringify(predicateName).replace(/"/g, "&quot;")}})"`
      const onAddEntry = `onclick="dslRules.addPredicateEntry({stepId:'${stepId}',predicateName:${JSON.stringify(predicateName).replace(/"/g, "&quot;")}})"`
      return `<div class="border border-slate-700 rounded px-2 py-2 mt-2 bg-slate-900/30">
      <div class="flex items-center gap-1.5">
        <span class="text-xs text-slate-500">name</span>
        <input type="text" value="${esc(predicateName)}" ${onNameChange}
          class="flex-1 min-w-0 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono" />
        <button type="button" ${onRemove} class="text-xs text-slate-500 hover:text-red-400 px-1.5">✕ Remove</button>
      </div>
      ${entryRows || '<p class="text-xs text-slate-500 italic mt-1">No entries.</p>'}
      <button type="button" ${onAddEntry} class="text-xs text-slate-400 hover:text-blue-400 mt-1">+ entry</button>
    </div>`
    })
    .join("")
  const visibilityClass =
    predicateNames.length === 0 ? "hidden" : ""
  const predicatesKey = `${stepId}:predicates`
  const predOpenAttr = openDetailsKeys.has(predicatesKey)
    ? " open"
    : ""
  return `<details${predOpenAttr} class="mt-1 border border-slate-700/60 rounded"
    data-details-key="${predicatesKey}"
    ontoggle="dslRules.onDetailsToggle(this.dataset.detailsKey,this.open)">
    <summary class="cursor-pointer text-xs text-slate-400 px-2 py-1 select-none flex items-center gap-2">
      <span>Predicates (named conditions reusable via $ref)</span>
      <span class="text-[10px] text-slate-500">${predicateNames.length} defined</span>
    </summary>
    <div class="px-2 py-1.5">
      <button type="button" onclick="dslRules.addPredicate({stepId:'${stepId}'})"
        class="text-xs text-slate-300 hover:text-blue-400 border border-slate-700 hover:border-blue-500/40 rounded px-2 py-0.5">+ Add predicate</button>
      <div class="${visibilityClass}">
        ${predicateCards}
      </div>
    </div>
  </details>`
}

export function renderRulesField({ step }) {
  const stepId = step.id
  const rules = Array.isArray(step.params.rules)
    ? step.params.rules
    : []
  const predicates = isPlainObject(step.params.predicates)
    ? step.params.predicates
    : {}
  const isHasDefaultRules =
    step.params.hasDefaultRules === true

  const onDefaultRulesToggle = `onchange="dslRules.setHasDefaultRules({stepId:'${stepId}',isEnabled:this.checked})"`

  const defaultRuleCards = isHasDefaultRules
    ? DEFAULT_RULES_PREVIEW.map((rule, defaultIndex) =>
        renderRuleCard({
          stepId,
          ruleIndex: defaultIndex,
          rule,
          predicates,
          isReadOnly: true,
          totalRules: DEFAULT_RULES_PREVIEW.length,
        }),
      ).join("")
    : ""

  const defaultRulesSection = isHasDefaultRules
    ? `<div class="mt-2 pl-2 border-l-2 border-amber-700/40">
        <p class="text-xs text-amber-300/80 mb-1">Default rules (run before user rules; readonly):</p>
        ${defaultRuleCards}
      </div>`
    : ""

  const ruleCards = rules
    .map((rule, ruleIndex) => {
      const card = renderRuleCard({
        stepId,
        ruleIndex,
        rule,
        predicates,
        isReadOnly: false,
        totalRules: rules.length,
      })
      const insertStrip = renderInsertRuleStrip({
        stepId,
        insertIndex: ruleIndex + 1,
      })
      return card + insertStrip
    })
    .join("")

  const headerInsertStrip = renderInsertRuleStrip({
    stepId,
    insertIndex: 0,
  })

  // Snapshot open <details> from the live DOM before innerHTML is replaced.
  // ontoggle fires spuriously on element insertion/removal, so the live DOM
  // is the authoritative source of truth at render time.
  const dslBuilderEl = document.querySelector(
    `.dsl-rules-builder[data-step="${stepId}"]`,
  )
  if (dslBuilderEl) {
    dslBuilderEl
      .querySelectorAll("[data-details-key]")
      .forEach((detailsEl) => {
        if (detailsEl.open) {
          openDetailsKeys.add(detailsEl.dataset.detailsKey)
        } else {
          openDetailsKeys.delete(
            detailsEl.dataset.detailsKey,
          )
        }
      })
  }

  return `<div class="dsl-rules-builder space-y-2" data-step="${stepId}" data-field="rules">
    <div class="flex items-center justify-between">
      <label class="text-xs text-slate-300 font-medium">Rules</label>
      <label class="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
        <input type="checkbox" ${isHasDefaultRules ? "checked" : ""} ${onDefaultRulesToggle}
          class="w-3.5 h-3.5 rounded bg-slate-700 border-slate-500 accent-amber-500 cursor-pointer" />
        hasDefaultRules
      </label>
    </div>
    ${renderPredicatesManager({ stepId, predicates })}
    ${defaultRulesSection}
    ${rules.length === 0 ? `<p class="text-xs text-slate-500 italic mt-1">No user rules yet.</p>${headerInsertStrip}` : headerInsertStrip + ruleCards}
  </div>`
}
