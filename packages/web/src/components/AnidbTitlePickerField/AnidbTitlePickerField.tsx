import { Picker } from "@charcuterie/ui"
import type { AnidbTitle } from "@mux-magic/api/api-types"
import { useState } from "react"

import type { CommandField } from "../../commands/types"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import type { Step } from "../../types"
import { CommandFieldGroup } from "../CommandFieldGroup/CommandFieldGroup"
import { fetchAnidbTitles } from "./fetchAnidbTitles"

type AnidbTitlePickerFieldProps = {
  field: CommandField
  step: Step
}

// The seriesName override picker. The free-text input is the source of
// truth — the user types or character-cleans here, and its value goes
// verbatim into output filenames + the seriesFolderName output.
//
// "Load titles from AniDB" fetches the candidate titles for the sibling
// AniDB ID (field.sourceField, default "anidbId") into a dropdown;
// picking one drops it verbatim into the input — AniDB's actual form,
// backticks and all — for the user to then clean.
export const AnidbTitlePickerField = ({
  field,
  step,
}: AnidbTitlePickerFieldProps) => {
  const { setParam } = useBuilderActions()
  const value = step.params[field.name] ?? ""

  const sourceField = field.sourceField ?? "anidbId"
  const rawSourceId = step.params[sourceField]
  const anidbId = Number(rawSourceId)
  const hasAnidbId = Number.isFinite(anidbId) && anidbId > 0

  const [titles, setTitles] = useState<AnidbTitle[]>([])
  const [status, setStatus] = useState<
    "idle" | "loading" | "loaded" | "empty"
  >("idle")

  const handleLoad = async () => {
    if (!hasAnidbId) return
    setStatus("loading")
    const loaded = await fetchAnidbTitles(anidbId)
    setTitles(loaded)
    setStatus(loaded.length > 0 ? "loaded" : "empty")
  }

  const handleInput = (
    event: React.FormEvent<HTMLInputElement>,
  ) => {
    const newValue = (event.target as HTMLInputElement)
      .value
    setParam(step.id, field.name, newValue || undefined)
  }

  const handlePick = (picked: string) => {
    if (picked) {
      setParam(step.id, field.name, picked)
    }
  }

  return (
    <CommandFieldGroup field={field}>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            aria-label={field.label ?? field.name}
            value={String(value)}
            placeholder={field.placeholder ?? ""}
            onInput={handleInput}
            className="w-full bg-surface-raised text-content-primary text-xs rounded px-2 py-1.5 border border-border-default focus:outline-none focus:border-border-focus"
          />
          <button
            type="button"
            onClick={handleLoad}
            disabled={!hasAnidbId || status === "loading"}
            className="shrink-0 text-xs bg-intent-neutral-surface hover:bg-intent-neutral-surface-hover text-intent-neutral-content rounded px-1.5 py-0.5 border border-intent-neutral-border focus:outline-none focus:border-border-focus cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === "loading"
              ? "Loading…"
              : "Load titles from AniDB"}
          </button>
        </div>

        {status === "loaded" && titles.length > 0 ? (
          // No `value`: this is a fire-and-reset action picker. Nothing
          // is stored here — a pick copies the title into the input
          // above — so the placeholder is the resting label and every
          // choice is a real change.
          <Picker
            className="w-full justify-between font-normal"
            label="AniDB title candidates"
            onChange={handlePick}
            options={titles.map((title) => ({
              label: `${title.type} (${title.lang}): ${title.value}`,
              value: title.value,
            }))}
            placeholder="Pick a title to copy into the field…"
            size="sm"
          />
        ) : null}

        {status === "empty" ? (
          <p className="text-xs text-content-muted">
            No titles found for this AniDB ID.
          </p>
        ) : null}

        {!hasAnidbId ? (
          <p className="text-xs text-content-muted">
            Set the AniDB Anime ID first, then load its
            titles.
          </p>
        ) : null}
      </div>
    </CommandFieldGroup>
  )
}
