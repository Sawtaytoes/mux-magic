import { Button, IconButton, Picker } from "@charcuterie/ui"
import { useAtomValue, useSetAtom } from "jotai"
import { useRef } from "react"
import { apiBase } from "../../apiBase"
import { fileExplorerAtom } from "../../components/FileExplorerModal/fileExplorerAtom"
import {
  cancelVariableDeleteAtom,
  confirmVariableDeleteAtom,
  pendingVariableDeleteAtom,
  removeVariableAtom,
  setVariableResolutionAtom,
  setVariableValueAtom,
  variablesAtom,
} from "../../state/variablesAtom"
import type { Variable } from "../../types"
import { ThreadCountVariableCard } from "../ThreadCountVariableCard/ThreadCountVariableCard"
import { AnidbIdInput } from "./AnidbIdInput"
import { DvdCompareIdInput } from "./DvdCompareIdInput"
import { MalIdInput } from "./MalIdInput"
import { PathValueInput } from "./PathValueInput"
import { TmdbIdInput } from "./TmdbIdInput"

interface VariableCardProps {
  variable: Variable
  isFirst: boolean
}

export const VariableCard = ({
  variable,
  isFirst,
}: VariableCardProps) => {
  const allVariables = useAtomValue(variablesAtom)
  const setValue = useSetAtom(setVariableValueAtom)
  const setVariables = useSetAtom(variablesAtom)
  const setFileExplorer = useSetAtom(fileExplorerAtom)
  const remove = useSetAtom(removeVariableAtom)
  const setResolution = useSetAtom(
    setVariableResolutionAtom,
  )
  const confirm = useSetAtom(confirmVariableDeleteAtom)
  const cancel = useSetAtom(cancelVariableDeleteAtom)
  const pending = useAtomValue(pendingVariableDeleteAtom)

  const valueInputRef = useRef<HTMLInputElement | null>(
    null,
  )

  const setLabel = (label: string) => {
    setVariables((variables) =>
      variables.map((existingVariable) =>
        existingVariable.id === variable.id
          ? { ...existingVariable, label }
          : existingVariable,
      ),
    )
  }

  const handleBrowse = async () => {
    if (variable.value) {
      setFileExplorer({
        path: variable.value,
        pickerOnSelect: null,
      })
    } else {
      let startPath = "/"
      try {
        const response = await fetch(
          `${apiBase}/files/default-path`,
        )
        const data = (await response.json()) as {
          path?: string
        }
        startPath = data.path ?? "/"
      } catch {
        // fall back to "/"
      }
      setFileExplorer({
        path: startPath,
        pickerOnSelect: (selectedPath) => {
          setValue({
            variableId: variable.id,
            value: selectedPath,
          })
        },
      })
    }
  }

  const isPendingDelete =
    pending !== null && pending.variableId === variable.id
  const otherVariables = allVariables.filter(
    (otherVariable) =>
      otherVariable.id !== variable.id &&
      otherVariable.type === variable.type,
  )

  return (
    <div
      data-path-var={variable.id}
      className="col-span-full bg-surface-raised/40 rounded-xl border border-dashed border-border-default px-4 py-3"
    >
      <div className="flex items-center gap-2 mb-2">
        {variable.type === "path" && (
          <IconButton
            intent="neutral"
            appearance="ghost"
            size="sm"
            onClick={handleBrowse}
            title={
              variable.value
                ? "Browse files in this folder"
                : "Browse to pick a folder for this path variable"
            }
            label={
              variable.value
                ? "Browse files in this folder"
                : "Pick a folder for this path variable"
            }
            className="shrink-0"
          >
            📁
          </IconButton>
        )}
        <input
          type="text"
          defaultValue={variable.label}
          data-action="set-path-label"
          data-pv-id={variable.id}
          onChange={(event) =>
            setLabel(event.currentTarget.value)
          }
          className="text-xs font-medium text-content-secondary bg-transparent border-b border-border-default focus:outline-none focus:border-border-focus flex-1 min-w-0"
        />
        <span className="text-xs text-content-muted font-mono shrink-0">
          {variable.type} variable
        </span>
        {/* The seeded basePath (first path) is undeletable so a fresh
            sequence always has somewhere to write the build root. Any
            other variable — additional paths, dvdCompareId entries, the
            singleton threadCount — uses the standard remove flow. */}
        {!(isFirst && variable.type === "path") && (
          <IconButton
            intent="danger"
            appearance="ghost"
            size="sm"
            onClick={() => remove(variable.id)}
            title={`Remove ${variable.type} variable`}
            label={`Remove ${variable.type} variable`}
          >
            ✕
          </IconButton>
        )}
      </div>
      {variable.type === "path" && (
        <PathValueInput
          variable={variable}
          valueInputRef={valueInputRef}
          onValueChange={(value) =>
            setValue({ variableId: variable.id, value })
          }
        />
      )}
      {variable.type === "dvdCompareId" && (
        <DvdCompareIdInput
          variable={variable as Variable<"dvdCompareId">}
          onValueChange={(value) =>
            setValue({ variableId: variable.id, value })
          }
        />
      )}
      {variable.type === "threadCount" && (
        <ThreadCountVariableCard
          variable={variable as Variable<"threadCount">}
          onValueChange={(value) =>
            setValue({ variableId: variable.id, value })
          }
        />
      )}
      {variable.type === "tmdbId" && (
        <TmdbIdInput
          variable={variable as Variable<"tmdbId">}
          onValueChange={(value) =>
            setValue({ variableId: variable.id, value })
          }
        />
      )}
      {variable.type === "anidbId" && (
        <AnidbIdInput
          variable={variable as Variable<"anidbId">}
          onValueChange={(value) =>
            setValue({ variableId: variable.id, value })
          }
        />
      )}
      {variable.type === "malId" && (
        <MalIdInput
          variable={variable as Variable<"malId">}
          onValueChange={(value) =>
            setValue({ variableId: variable.id, value })
          }
        />
      )}
      {isPendingDelete && (
        <div
          role="alert"
          className="mt-3 rounded-lg border border-intent-warning-border bg-intent-warning-surface px-3 py-2 text-xs"
        >
          <p className="text-intent-warning-content font-medium mb-2">
            This variable is used by the following fields.
            Choose what to do with each:
          </p>
          <div className="flex flex-col gap-2">
            {pending.usages.map(({ stepId, fieldName }) => (
              <div
                key={`${stepId}:${fieldName}`}
                className="flex items-center gap-2"
              >
                <span className="text-content-secondary font-mono shrink-0">
                  {stepId} → {fieldName}
                </span>
                <Picker
                  className="ms-auto justify-between font-normal"
                  label={`Resolution for ${stepId} ${fieldName}`}
                  onChange={(resolutionValue) => {
                    setResolution({
                      stepId,
                      fieldName,
                      resolution:
                        resolutionValue === "unlink"
                          ? { kind: "unlink" }
                          : {
                              kind: "replace",
                              targetId: resolutionValue,
                            },
                    })
                  }}
                  options={[
                    {
                      label: "Unlink (use literal value)",
                      value: "unlink",
                    },
                    ...otherVariables.map(
                      (otherVariable) => ({
                        label: `Replace with: ${otherVariable.label}`,
                        value: otherVariable.id,
                      }),
                    ),
                  ]}
                  size="sm"
                  value="unlink"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <Button
              intent="danger"
              appearance="solid"
              size="sm"
              onClick={() => confirm()}
            >
              Delete and apply
            </Button>
            <Button
              intent="neutral"
              appearance="outline"
              size="sm"
              onClick={() => cancel()}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
