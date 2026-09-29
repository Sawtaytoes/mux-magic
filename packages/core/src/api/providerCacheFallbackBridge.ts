import { registerProviderCacheFallbackListener } from "../provider-cache/providerCacheFallbacks.js"
import { setProviderCircuitScopeResolver } from "../provider-cache/providerCircuitBreaker.js"
import {
  getRootJobId,
  recordProviderCacheFallback,
} from "./jobStore.js"
import { getActiveJobId } from "./logCapture.js"

// Connects the provider cache to the job layer without the cache importing
// it. Call once at server startup, beside `installLogBridge`.
//
//  - A cache fallback during a job lands on that job (and its umbrella),
//    where the Builder and the Jobs page read it.
//  - The circuit breaker is scoped to the root job, so a sequence's steps
//    share one; a read outside any job (a Builder lookup) gets no circuit.
const unregisterHolder = new Map<"unregister", () => void>()

export const installProviderCacheFallbackBridge = () => {
  if (unregisterHolder.has("unregister") === false) {
    setProviderCircuitScopeResolver((jobId) =>
      jobId === undefined ? null : getRootJobId(jobId),
    )
    unregisterHolder.set(
      "unregister",
      registerProviderCacheFallbackListener((fallback) => {
        const jobId = getActiveJobId()
        if (jobId !== undefined) {
          recordProviderCacheFallback({
            fallback,
            jobId,
          })
        }
      }),
    )
  }
}

export const uninstallProviderCacheFallbackBridge = () => {
  unregisterHolder.get("unregister")?.()
  unregisterHolder.clear()
  setProviderCircuitScopeResolver(null)
}
