import { atom } from "jotai"
import { apiBase } from "../../apiBase"

export type WebhookDeliveryState =
  | "pending"
  | "delivered"
  | "exhausted"

export type WebhookDelivery = {
  state: WebhookDeliveryState
  attempts: number
  lastAttemptAt?: string
  lastError?: string
}

export type PersistedJobError = {
  id: string
  jobId: string
  stepIndex?: number
  fileId?: string
  level: "error"
  msg: string
  errorName?: string
  stack?: string
  traceId?: string
  spanId?: string
  occurredAt: string
  webhookDelivery: WebhookDelivery
}

export type ErrorsFilter = {
  state?: WebhookDeliveryState
  jobId?: string
}

export const errorsAtom = atom<PersistedJobError[]>([])

export const errorsFilterAtom = atom<ErrorsFilter>({})

export const buildErrorsUrl = (filter: ErrorsFilter) => {
  const params = new URLSearchParams()
  if (filter.state !== undefined) {
    params.set("state", filter.state)
  }
  if (filter.jobId !== undefined && filter.jobId !== "") {
    params.set("jobId", filter.jobId)
  }
  const query = params.toString()
  return query.length > 0
    ? `${apiBase}/errors?${query}`
    : `${apiBase}/errors`
}

export const errorsFetchAtom = atom(
  (get) => get(errorsAtom),
  async (get, set, filter?: ErrorsFilter) => {
    const activeFilter = filter ?? get(errorsFilterAtom)
    const url = buildErrorsUrl(activeFilter)
    const response = await fetch(url)
    if (response.ok) {
      const records =
        (await response.json()) as PersistedJobError[]
      set(errorsAtom, records)
    }
  },
)
