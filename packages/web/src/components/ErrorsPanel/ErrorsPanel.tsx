import { Select } from "@charcuterie/ui"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { useEffect } from "react"
import { apiBase } from "../../apiBase"
import { ErrorRow } from "./ErrorRow"
import {
  errorsAtom,
  errorsFetchAtom,
  errorsFilterAtom,
  type PersistedJobError,
  type WebhookDeliveryState,
} from "./errorAtoms"

const DELIVERY_STATES: WebhookDeliveryState[] = [
  "pending",
  "delivered",
  "exhausted",
]

export const ErrorsPanel = () => {
  const records = useAtomValue(errorsAtom)
  const [filter, setFilter] = useAtom(errorsFilterAtom)
  const fetchErrors = useSetAtom(errorsFetchAtom)

  useEffect(() => {
    void fetchErrors(filter)
  }, [filter, fetchErrors])

  const handleStateChange = (value: string) => {
    setFilter((previous) => ({
      ...previous,
      state:
        value === ""
          ? undefined
          : (value as WebhookDeliveryState),
    }))
  }

  const handleJobIdChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = event.target.value
    setFilter((previous) => ({
      ...previous,
      jobId: value === "" ? undefined : value,
    }))
  }

  const handleDismiss = (recordId: string) => async () => {
    await fetch(`${apiBase}/errors/${recordId}`, {
      method: "DELETE",
    })
    await fetchErrors(filter)
  }

  const handleRedeliver =
    (recordId: string) => async () => {
      await fetch(
        `${apiBase}/errors/${recordId}/redeliver`,
        {
          method: "POST",
        },
      )
      await fetchErrors(filter)
    }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-xl font-semibold">Errors</h2>
        <span className="text-sm text-slate-400">
          ({records.length})
        </span>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex w-40 items-center gap-2 text-sm text-slate-400">
          <Select
            label="State"
            onChange={handleStateChange}
            options={[
              { label: "All", value: "" },
              ...DELIVERY_STATES.map((deliveryState) => ({
                label: deliveryState,
                value: deliveryState,
              })),
            ]}
            size="sm"
            value={filter.state ?? ""}
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-400">
          <span>Job ID</span>
          <input
            type="text"
            aria-label="Job ID"
            value={filter.jobId ?? ""}
            onChange={handleJobIdChange}
            placeholder="filter by job ID"
            className="bg-slate-800 border border-slate-600 text-slate-200 text-xs rounded px-2 py-1 w-40"
          />
        </label>
      </div>

      {/* Records list */}
      {records.length === 0 ? (
        <p className="text-slate-500 text-sm py-4">
          No errors recorded yet.
        </p>
      ) : (
        <div className="space-y-2">
          {records.map((record: PersistedJobError) => (
            <ErrorRow
              key={record.id}
              record={record}
              onDismiss={handleDismiss(record.id)}
              onRedeliver={handleRedeliver(record.id)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
