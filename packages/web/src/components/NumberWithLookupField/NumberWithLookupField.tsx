import { useSetAtom } from "jotai"

import { LOOKUP_LINKS } from "../../commands/lookupLinks"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import { lookupModalAtom } from "../../state/uiAtoms"
import type {
  CommandField,
  LookupType,
  Step,
} from "../../types"
import { FieldLabel } from "../FieldLabel/FieldLabel"

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
      loading: false,
    })
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

  return (
    <div className="mb-2">
      <FieldLabel command={step.command} field={field} />
      <div className="flex items-center gap-2">
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
          className="flex-1 min-w-0 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500"
        />
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
