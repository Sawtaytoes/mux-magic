import { useSetAtom, useStore } from "jotai"
import { useEffect, useRef } from "react"

import { LOOKUP_LINKS } from "../../commands/lookupLinks"
import type { CommandField } from "../../commands/types"
import { lookupModalAtom } from "../../components/LookupModal/lookupModalAtom"
import type { LookupType } from "../../components/LookupModal/types"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import { setParamAtom } from "../../state/stepAtoms"
import type { Step } from "../../types"
import { parseDvdCompareDisplayName } from "../../utils/parseDvdCompareDisplayName"
import { FieldLabel } from "../FieldLabel/FieldLabel"
import { ChevronDownSvg } from "./ChevronDownSvg"
import { ChevronUpSvg } from "./ChevronUpSvg"
import {
  buildReverseLookupRequest,
  resolveTmdbForBaseTitle,
  runReverseLookup,
} from "./runReverseLookup"

type NumberWithLookupFieldProps = {
  field: CommandField
  step: Step
}

const REVERSE_LOOKUP_DEBOUNCE_MS = 600

// Parses an <input type="number"> raw string into a real number, returning
// `undefined` for empty, partial ("1e"), or otherwise non-finite values.
// Chromium considers "1e" / "1." valid intermediate states while a user
// is typing, but Number("1e") is NaN — without this guard, NaN would
// flow into setParam and React would render `value={NaN}` as the literal
// string "NaN" in the input.
const parseNumericInputValue = (
  raw: string,
): number | undefined => {
  if (raw === "") return undefined
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : undefined
}

export const NumberWithLookupField = ({
  field,
  step,
}: NumberWithLookupFieldProps) => {
  const { setParam } = useBuilderActions()
  const setLookupModal = useSetAtom(lookupModalAtom)
  const store = useStore()

  // Defensive read: if a stale NaN ever slipped into params (older
  // builds before parseNumericInputValue, or a programmatic write that
  // bypassed the guard), surface it as an empty input rather than the
  // literal string "NaN".
  const storedValue = step.params[field.name] as
    | number
    | undefined
  const rawValue =
    typeof storedValue === "number" &&
    Number.isFinite(storedValue)
      ? storedValue
      : ""
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

  const isNameSpecialFeaturesDvdCompareCard =
    step.command === "nameSpecialFeaturesDvdCompareTmdb" &&
    lookupType === "dvdcompare" &&
    field.name === "dvdCompareId"

  // Reverse-lookup scheduling.
  // ──────────────────────────
  // Token-based cancellation (mirrors legacy public/builder/js/lookup-modal/
  // reverse-lookup.js): each scheduled call captures the rawValue as a token;
  // when the response lands, we discard it unless the token is still current.
  // Bypass useBuilderActions.setParam so background resolution writes never
  // pollute undo history.
  const debounceTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null)
  const requestTokenRef = useRef<string | null>(null)

  // Sibling dvdCompareId is needed to look up release labels by hash.
  const siblingDvdCompareId =
    field.name === "dvdCompareReleaseHash"
      ? (step.params.dvdCompareId as number | undefined)
      : undefined

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    if (!field.companionNameField) return
    if (
      !lookupType &&
      field.name !== "dvdCompareReleaseHash"
    )
      return
    // Companion already filled — assume it matches the current ID
    // (LookupModal pick, YAML cache, or prior auto-resolve all leave them
    // in sync). The onChange handler clears it whenever the ID changes.
    if (companionName) return
    if (rawValue === "" || rawValue === undefined) return
    const numericId = Number(rawValue)
    if (!Number.isFinite(numericId) || numericId <= 0)
      return

    const request = buildReverseLookupRequest({
      fieldName: field.name,
      lookupType,
      numericId,
      dvdCompareId: siblingDvdCompareId,
    })
    if (!request) return

    const token = String(rawValue)
    requestTokenRef.current = token
    const stepId = step.id
    const companionField = field.companionNameField
    const isDvdCompareCardLocal =
      isNameSpecialFeaturesDvdCompareCard

    debounceTimerRef.current = setTimeout(async () => {
      debounceTimerRef.current = null
      const name = await runReverseLookup(request)
      if (requestTokenRef.current !== token) return
      if (!name) return
      store.set(setParamAtom, {
        stepId,
        fieldName: companionField,
        value: name,
      })
      // Cascade: after a DVDCompare film resolves on a nameSpecialFeaturesDvdCompareTmdb
      // card, kick the secondary TMDB resolution (right-side link target).
      if (isDvdCompareCardLocal) {
        const parsed = parseDvdCompareDisplayName(name)
        if (parsed?.baseTitle) {
          const tmdb = await resolveTmdbForBaseTitle(parsed)
          if (requestTokenRef.current !== token) return
          if (tmdb) {
            store.set(setParamAtom, {
              stepId,
              fieldName: "tmdbId",
              value: tmdb.tmdbId,
            })
            store.set(setParamAtom, {
              stepId,
              fieldName: "tmdbName",
              value: tmdb.tmdbName,
            })
          }
        }
      }
    }, REVERSE_LOOKUP_DEBOUNCE_MS)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
    }
  }, [
    rawValue,
    companionName,
    lookupType,
    field.name,
    field.companionNameField,
    siblingDvdCompareId,
    isNameSpecialFeaturesDvdCompareCard,
    step.id,
    store,
  ])

  // Clear cached companion + cascade-clear dependent fields whenever the
  // user edits the ID. Uses setParamAtom directly so the cascade clears
  // don't each create their own undo entry — only the user's setParam call
  // for the ID change goes through useBuilderActions.
  const handleIdChange = (
    nextValue: number | undefined,
  ) => {
    setParam(step.id, field.name, nextValue)
    if (field.companionNameField) {
      store.set(setParamAtom, {
        stepId: step.id,
        fieldName: field.companionNameField,
        value: undefined,
      })
    }
    if (field.name === "dvdCompareId") {
      store.set(setParamAtom, {
        stepId: step.id,
        fieldName: "dvdCompareReleaseLabel",
        value: undefined,
      })
      store.set(setParamAtom, {
        stepId: step.id,
        fieldName: "tmdbId",
        value: undefined,
      })
      store.set(setParamAtom, {
        stepId: step.id,
        fieldName: "tmdbName",
        value: undefined,
      })
    }
    requestTokenRef.current = null
  }

  const handleLookup = () => {
    if (!lookupType) return
    setLookupModal({
      lookupType: lookupType,
      stepId: step.id,
      fieldName: field.name,
      companionNameField: field.companionNameField ?? null,
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
    const current =
      typeof rawValue === "number" &&
      Number.isFinite(rawValue)
        ? rawValue
        : 0
    handleIdChange(rawValue === "" ? 1 : current + 1)
  }

  const handleDecrement = () => {
    const current =
      typeof rawValue === "number" &&
      Number.isFinite(rawValue)
        ? rawValue
        : 0
    handleIdChange(rawValue === "" ? 0 : current - 1)
  }

  const companionHref = (() => {
    if (!lookupConfig || !rawValue) {
      return lookupConfig?.homeUrl ?? "#"
    }
    if (
      step.command ===
        "nameSpecialFeaturesDvdCompareTmdb" &&
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

  // Right-side text link, mirrors legacy public/builder/js/fields/
  // number-with-lookup-field.js. Two cases:
  //   (a) nameSpecialFeaturesDvdCompareTmdb + dvdcompare → "↗ Open on TheMovieDB". Target
  //       prefers tmdbId (resolved via secondary TMDB search), then falls
  //       back to a TMDB search-by-title URL using the parsed DVDCompare
  //       display name, then TMDB home.
  //   (b) Other dvdcompare cards → "↗ open release on DVDCompare".
  const tmdbId = step.params.tmdbId as number | undefined
  const rightSideLink = (() => {
    if (isNameSpecialFeaturesDvdCompareCard) {
      let href = "https://www.themoviedb.org/"
      if (tmdbId) {
        href = `https://www.themoviedb.org/movie/${encodeURIComponent(tmdbId)}`
      } else if (companionName) {
        const parsed =
          parseDvdCompareDisplayName(companionName)
        const fallbackTitle = parsed?.baseTitle ?? null
        if (fallbackTitle) {
          const searchQuery = parsed?.year
            ? `${fallbackTitle} y:${parsed.year}`
            : fallbackTitle
          href = `https://www.themoviedb.org/search/movie?query=${encodeURIComponent(searchQuery)}`
        }
      }
      return { href, label: "Open on TheMovieDB" }
    }
    if (lookupType === "dvdcompare" && lookupConfig) {
      const href = rawValue
        ? lookupConfig.buildUrl(rawValue, step.params)
        : lookupConfig.homeUrl
      return { href, label: lookupConfig.label }
    }
    return null
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
                handleIdChange(
                  parseNumericInputValue(
                    event.target.value,
                  ),
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
              handleIdChange(
                parseNumericInputValue(event.target.value),
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
      {(companionName || rightSideLink) && (
        <div className="flex items-start gap-2 mt-0.5">
          {lookupConfig ? (
            <a
              href={companionHref}
              target="_blank"
              rel="noopener noreferrer"
              title={companionName}
              className={`flex-1 min-w-0 truncate text-xs text-blue-400 hover:text-blue-300 hover:underline ${companionName ? "" : "invisible"}`}
              data-step={step.id}
              data-companion={field.name}
            >
              {companionName || " "}
            </a>
          ) : (
            <p
              className={`flex-1 min-w-0 text-xs text-slate-500 truncate ${companionName ? "" : "hidden"}`}
              title={companionName}
            >
              {companionName}
            </p>
          )}
          {rightSideLink && (
            <a
              href={rightSideLink.href}
              target="_blank"
              rel="noopener noreferrer"
              data-step={step.id}
              data-right-link={field.name}
              className="shrink-0 text-xs text-blue-400 hover:text-blue-300 hover:underline inline-flex items-center gap-1"
            >
              ↗ {rightSideLink.label}
            </a>
          )}
        </div>
      )}
    </div>
  )
}
