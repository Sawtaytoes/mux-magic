import { IconButton } from "@charcuterie/ui"
import { useSetAtom, useStore } from "jotai"

import { LOOKUP_LINKS } from "../../commands/lookupLinks"
import type { CommandField } from "../../commands/types"
import { lookupModalAtom } from "../../components/LookupModal/lookupModalAtom"
import type { LookupType } from "../../components/LookupModal/types"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import { setParamAtom } from "../../state/stepAtoms"
import type { Step } from "../../types"
import { CommandFieldControl } from "../CommandFieldControl/CommandFieldControl"
import { CommandFieldGroup } from "../CommandFieldGroup/CommandFieldGroup"

type StringFieldProps = {
  field: CommandField
  step: Step
}

export const StringField = ({
  field,
  step,
}: StringFieldProps) => {
  const { setParam } = useBuilderActions()
  const setLookupModal = useSetAtom(lookupModalAtom)
  const store = useStore()
  const value = step.params[field.name] ?? ""
  const lookupType = field.lookupType as
    | LookupType
    | undefined
  const lookupConfig = lookupType
    ? LOOKUP_LINKS[lookupType]
    : null
  const companionName = field.companionNameField
    ? ((step.params[field.companionNameField] as
        | string
        | undefined) ?? "")
    : ""

  const handleInput = (
    event: React.FormEvent<HTMLInputElement>,
  ) => {
    const newValue = (event.target as HTMLInputElement)
      .value
    setParam(step.id, field.name, newValue || undefined)
    if (field.companionNameField) {
      store.set(setParamAtom, {
        stepId: step.id,
        fieldName: field.companionNameField,
        value: undefined,
      })
    }
  }

  const input = (
    <input
      id={`${step.id}-${field.name}`}
      type="text"
      defaultValue={String(value)}
      placeholder={field.placeholder ?? ""}
      onInput={handleInput}
      className="w-full min-w-0 bg-surface-sunken text-content-primary text-xs rounded px-2 py-1.5 border border-border-default focus:outline-none focus:border-border-focus"
    />
  )

  if (lookupType) {
    const handleLookup = () => {
      setLookupModal({
        lookupType,
        stepId: step.id,
        fieldName: field.name,
        companionNameField:
          field.companionNameField ?? null,
        stage: "search",
        searchTerm: companionName
          .replace(/\s+—.+$/u, "")
          .replace(/\s+\(\d{4}\)$/u, ""),
        searchError: null,
        results: null,
        formatFilter: "all",
        selectedGroup: null,
        selectedVariant: null,
        selectedFid: null,
        releases: null,
        releasesDebug: null,
        releasesError: null,
        isLoading: false,
      })
    }
    const href =
      lookupConfig && value
        ? lookupConfig.buildUrl(value, step.params)
        : lookupConfig?.homeUrl

    return (
      <CommandFieldGroup field={field}>
        <div className="flex items-center gap-2">
          {input}
          <IconButton
            label={`Look up ${field.label ?? field.name}`}
            title={`Look up ${field.label ?? field.name}`}
            intent="neutral"
            appearance="soft"
            size="sm"
            onClick={handleLookup}
            className="shrink-0"
          >
            🔍
          </IconButton>
        </div>
        {companionName && href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title={companionName}
            className="mt-0.5 block truncate text-xs text-intent-accent-content hover:underline"
          >
            {companionName}
          </a>
        ) : null}
      </CommandFieldGroup>
    )
  }

  return (
    <CommandFieldControl field={field}>
      {input}
    </CommandFieldControl>
  )
}
