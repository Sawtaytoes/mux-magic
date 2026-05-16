import type { VariableTypeDefinition } from "../../components/VariableCard/registry"

// Definition for the `threadCount` Variable type. registry.ts registers
// this; the input is rendered by VariableCard.tsx dispatching on type
// (renderValueInput here throws to keep callers honest).
//
// Singleton: a sequence has at most one threadCount (the per-job thread
// cap from worker 11). Not linkable: nothing in step params refers to it
// by Variable id — the server reads `variables.tc.value` directly from
// the YAML envelope. The fixed id "tc" matches the on-disk format worker
// 11 introduced, so already-saved YAML round-trips unchanged.
export const THREAD_COUNT_VARIABLE_DEFINITION: VariableTypeDefinition<"threadCount"> =
  {
    type: "threadCount",
    label: "Max threads (per job)",
    cardinality: "singleton",
    isLinkable: false,
    canonicalId: "tc",
    defaultValue: () => "",
    renderValueInput: () => {
      throw new Error(
        "threadCount renderValueInput is wired in VariableCard.tsx",
      )
    },
  }
