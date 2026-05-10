import { useBuilderActions } from "../../hooks/useBuilderActions"
import type {
  LookupRelease,
  LookupState,
} from "../../types"

const fetchReleases = async (
  dvdCompareId: string,
): Promise<{
  releases: LookupRelease[]
  debug: unknown
  error: string | null
}> => {
  try {
    const resp = await fetch(
      "/queries/listDvdCompareReleases",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dvdCompareId }),
      },
    )
    const data = (await resp.json()) as {
      releases?: LookupRelease[]
      debug?: unknown
      error?: string
    }
    return {
      releases: data.releases ?? [],
      debug: data.debug ?? null,
      error: data.error ?? null,
    }
  } catch (error) {
    return {
      releases: [],
      debug: null,
      error:
        error instanceof Error
          ? error.message
          : String(error),
    }
  }
}

interface LookupVariantStageProps {
  state: LookupState
  onUpdate: (patch: Partial<LookupState>) => void
  onClose: () => void
}

export const LookupVariantStage = ({
  state,
  onUpdate,
  onClose,
}: LookupVariantStageProps) => {
  const { setParam } = useBuilderActions()
  const group = state.selectedGroup
  if (!group) return null

  const selectVariant = (
    variantId: string,
    variant: string,
  ) => {
    onUpdate({
      selectedFid: variantId,
      selectedVariant: variant,
      stage: "release",
      releases: null,
      loading: true,
    })
    fetchReleases(variantId).then(
      ({ releases, debug, error }) => {
        if (releases.length === 1) {
          setParam(state.stepId, state.fieldName, {
            hash: releases[0].hash,
            label: releases[0].label,
          })
          onClose()
        } else {
          onUpdate({
            releases,
            releasesDebug: debug,
            releasesError: error,
            loading: false,
          })
        }
      },
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-slate-400 text-xs">
        Select a variant for "{group.baseTitle}":
      </p>
      {group.variants.map((variant, index) => (
        <button
          type="button"
          key={variant.id}
          onClick={() =>
            selectVariant(variant.id, variant.variant)
          }
          className="text-left text-sm px-3 py-2 rounded border border-slate-700 hover:border-blue-500 hover:bg-blue-900/20 text-slate-200 transition-colors"
        >
          <span className="text-xs font-mono bg-slate-700 px-1 rounded mr-2">
            {index + 1}
          </span>
          {variant.variant}
        </button>
      ))}
    </div>
  )
}
