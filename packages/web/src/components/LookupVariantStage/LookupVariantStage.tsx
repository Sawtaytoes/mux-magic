import type {
  ListDvdCompareReleasesResponse,
  ProviderCacheFallback,
} from "@mux-magic/api/api-types"
import { apiBase } from "../../apiBase"
import type {
  LookupRelease,
  LookupState,
} from "../../components/LookupModal/types"
import { useBuilderActions } from "../../hooks/useBuilderActions"

const fetchReleases = async (
  dvdCompareId: string,
): Promise<{
  releases: LookupRelease[]
  debug: unknown
  error: string | null
  providerCacheFallbacks: ProviderCacheFallback[]
}> => {
  try {
    const resp = await fetch(
      `${apiBase}/queries/listDvdCompareReleases`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dvdCompareId: Number(dvdCompareId),
        }),
      },
    )
    if (!resp.ok) {
      return {
        releases: [],
        debug: null,
        error: `Server error: ${resp.status} ${resp.statusText}`,
        providerCacheFallbacks: [],
      }
    }
    const data =
      (await resp.json()) as ListDvdCompareReleasesResponse
    return {
      providerCacheFallbacks:
        data.providerCacheFallbacks ?? [],
      releases: data.releases ?? [],
      debug: data.debug ?? null,
      error: data.error ?? null,
    }
  } catch (error) {
    return {
      providerCacheFallbacks: [],
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
      isLoading: true,
    })
    fetchReleases(variantId).then(
      ({
        releases,
        debug,
        error,
        providerCacheFallbacks,
      }) => {
        if (
          releases.length === 1 &&
          providerCacheFallbacks.length === 0 &&
          (state.providerCacheFallbacks?.length ?? 0) === 0
        ) {
          setParam(state.stepId, state.fieldName, {
            hash: releases[0].hash,
            label: releases[0].label,
          })
          onClose()
        } else {
          onUpdate({
            providerCacheFallbacks: (
              state.providerCacheFallbacks ?? []
            ).concat(providerCacheFallbacks),
            releases,
            releasesDebug: debug,
            releasesError: error,
            isLoading: false,
          })
        }
      },
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-content-secondary text-xs">
        Select a variant for "{group.baseTitle}":
      </p>
      {group.variants.map((variant, index) => (
        <button
          type="button"
          key={variant.id}
          onClick={() =>
            selectVariant(variant.id, variant.variant)
          }
          className="text-start text-sm px-3 py-2 rounded hover:bg-intent-accent-surface text-content-primary transition-colors"
        >
          <span className="text-xs font-mono bg-surface-sunken px-1 rounded me-2">
            {index + 1}
          </span>
          {variant.variant}
        </button>
      ))}
    </div>
  )
}
