import { useSetAtom } from "jotai"

import { LOOKUP_LINKS } from "../../commands/lookupLinks"
import type { CommandField } from "../../commands/types"
import { lookupModalAtom } from "../../components/LookupModal/lookupModalAtom"
import type { LookupType } from "../../components/LookupModal/types"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import type { Step } from "../../types"
import { FieldLabel } from "../FieldLabel/FieldLabel"
import { ChevronDownSvg } from "./ChevronDownSvg"
import { ChevronUpSvg } from "./ChevronUpSvg"

type NumberWithLookupFieldProps = {
  field: CommandField
  step: Step
}

export const NumberWithLookupField = ({
  field,
  step,
}: NumberWithLookupFieldProps) => {
  const { setParam } = useBuilderActions()
  const setLookupModal = useSetAtom(lookupModalAtom)

  const rawValue =
    (step.params[field.name] as number | undefined) ?? ""
  const companionName = field.companionNameField
    ? ((step.params[field.companionNameField] as
        | string
        | undefined) ?? "")
    : ""
  const lookupType = field.lookupType as
    | LookupType
    | undefined
  const lookupConfig = lookupType
    ? LOOKUP_LINKS[lookupType]
    : null

  const hasIncrementButtons =
    field.hasIncrementButtons ?? true

  const handleLookup = () => {
    if (!lookupType) return
    setLookupModal({
      lookupType: lookupType,
      stepId: step.id,
      fieldName: field.name,
      stage: "search",
      searchTerm: "",
      searchError: null,
      results: null,
      formatFilter:
        lookupType === "dvdcompare" ? "Blu-ray 4K" : "all",
      selectedGroup: null,
      selectedVariant: null,
      selectedFid: null,
      releases: null,
      releasesDebug: null,
      releasesError: null,
      isLoading: false,
    })
  }

  const handleIncrement = () => {
    setParam(
      step.id,
      field.name,
      rawValue === "" ? 1 : Number(rawValue) + 1,
    )
  }

  const handleDecrement = () => {
    setParam(
      step.id,
      field.name,
      rawValue === "" ? 0 : Number(rawValue) - 1,
    )
  }

  const companionHref = (() => {
    if (!lookupConfig || !rawValue) {
      return lookupConfig?.homeUrl ?? "#"
    }
    if (
      step.command === "nameSpecialFeatures" &&
      lookupType === "dvdcompare"
    ) {
      return lookupConfig.buildUrl(rawValue, step.params)
    }
    if (lookupType === "dvdcompare") {
      return rawValue
        ? lookupConfig.buildUrl(rawValue, step.params)
        : lookupConfig.homeUrl
    }
    return lookupConfig.buildUrl(rawValue, step.params)
  })()

  const inputBaseClass =
    "flex-1 min-w-0 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500"

  return (
    <div className="mb-2">
      <FieldLabel command={step.command} field={field} />
      <div className="flex items-center gap-2">
        {hasIncrementButtons ? (
          <>
            <input
              type="number"
              id={`${step.command}-${field.name}`}
              value={rawValue}
              placeholder={field.placeholder ?? ""}
              onChange={(event) => {
                setParam(
                  step.id,
                  field.name,
                  event.target.value === ""
                    ? undefined
                    : Number(event.target.value),
                )
              }}
              className={`${inputBaseClass} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
            />
            <div className="flex flex-col shrink-0">
              <button
                type="button"
                onClick={handleIncrement}
                aria-label="Increment"
                className="bg-slate-700 hover:bg-blue-700 text-slate-200 hover:text-white px-1.5 py-0.5 rounded-t border border-slate-600 hover:border-blue-500 flex items-center justify-center"
              >
                <ChevronUpSvg />
              </button>
              <button
                type="button"
                onClick={handleDecrement}
                aria-label="Decrement"
                className="bg-slate-700 hover:bg-blue-700 text-slate-200 hover:text-white px-1.5 py-0.5 rounded-b border-x border-b border-slate-600 hover:border-blue-500 flex items-center justify-center"
              >
                <ChevronDownSvg />
              </button>
            </div>
          </>
        ) : (
          <input
            type="text"
            inputMode="numeric"
            id={`${step.command}-${field.name}`}
            value={rawValue}
            placeholder={field.placeholder ?? ""}
            onChange={(event) => {
              setParam(
                step.id,
                field.name,
                event.target.value === ""
                  ? undefined
                  : Number(event.target.value),
              )
            }}
            className={inputBaseClass}
          />
        )}
        <button
          type="button"
          onClick={handleLookup}
          title={`Look up ${field.label ?? field.name}`}
          aria-label={`Look up ${field.label ?? field.name}`}
          className="shrink-0 text-xs bg-slate-700 hover:bg-blue-700 text-slate-200 hover:text-white px-2.5 py-1.5 rounded border border-slate-600 hover:border-blue-500"
        >
          🔍
        </button>
      </div>
      {companionName && (
        <div className="flex items-start gap-2 mt-0.5">
          {lookupConfig ? (
            <a
              href={companionHref}
              target="_blank"
              rel="noopener noreferrer"
              title={companionName}
              className="flex-1 min-w-0 truncate text-xs text-blue-400 hover:text-blue-300 hover:underline"
            >
              {companionName}
            </a>
          ) : (
            <p
              className="flex-1 min-w-0 text-xs text-slate-500 truncate"
              title={companionName}
            >
              {companionName}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
