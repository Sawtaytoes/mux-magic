import {
  useAtom,
  useAtomValue,
  useSetAtom,
  useStore,
} from "jotai"
import { useCallback, useEffect, useState } from "react"
import {
  loadYamlFromText,
  toYamlStr,
} from "../../jobs/yamlCodec"
import { commandsAtom } from "../../state/commandsAtom"
import { pathsAtom } from "../../state/pathsAtom"
import { stepsAtom } from "../../state/stepsAtom"
import {
  deleteTemplate,
  fetchTemplate,
  fetchTemplateList,
  updateTemplate,
} from "../../state/templatesApi"
import {
  selectedTemplateIdAtom,
  templateLoadUndoAtom,
  templatesAtom,
  templatesErrorAtom,
} from "../../state/templatesAtoms"
import type {
  PathVariable,
  SequenceItem,
} from "../../types"
import { SavedTemplateRow } from "./SavedTemplateRow"
import { SaveTemplateModal } from "./SaveTemplateModal"

// The Saved Templates sidebar section. Owns the list-fetch lifecycle
// and all mutation side-effects against the live sequence atoms.
//
// Loading a template snapshots the current sequence into
// templateLoadUndoAtom before replacing it, so the undo-toast (rendered
// below) can restore prior state. Loading also clears ?seq= from the
// URL — the URL query string remains the "share this instance"
// mechanism, but the server-backed template is now the canonical
// re-usable form, so the live URL should not carry stale instance
// state once a named template has been applied.
export const SavedTemplatesPanel = () => {
  const store = useStore()
  const templates = useAtomValue(templatesAtom)
  const setTemplates = useSetAtom(templatesAtom)
  const [selectedTemplateId, setSelectedTemplateId] =
    useAtom(selectedTemplateIdAtom)
  const [errorMessage, setErrorMessage] = useAtom(
    templatesErrorAtom,
  )
  const [undoSnapshot, setUndoSnapshot] = useAtom(
    templateLoadUndoAtom,
  )
  // Snapshot of the yaml at the moment the user opens the modal. We
  // freeze it here rather than reading live atoms inside the modal so
  // edits to the sequence made after opening the modal don't change
  // what gets saved — the user's intent at click-time is the contract.
  const [pendingSaveYaml, setPendingSaveYaml] = useState<
    string | null
  >(null)
  const isSaveModalOpen = pendingSaveYaml !== null

  // Surfaces a failure inline in the sidebar. Used only for failures
  // during user-initiated actions (save, update, delete, load) so the
  // user sees what just broke. Passive failures during the initial
  // list fetch are kept silent — the empty-list fallback ("No saved
  // templates yet.") is the right rendering in deployments where the
  // api isn't reachable (e.g. SPA served standalone without window
  // .__API_BASE__ pointing anywhere useful), and a permanent red
  // alert on every page load otherwise leaks into unrelated tests
  // and noisily clutters the sidebar for users who don't use
  // templates at all.
  const surfaceActionError = useCallback(
    (error: unknown) => {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : String(error),
      )
    },
    [setErrorMessage],
  )

  const refetch = useCallback(async () => {
    try {
      const list = await fetchTemplateList()
      setTemplates(list)
      setErrorMessage(null)
    } catch {
      // Initial-load failures (and refetches after an action) stay
      // silent — see the comment above. Reaching the api is a system
      // concern; the empty-list fallback covers the UI.
    }
  }, [setTemplates, setErrorMessage])

  useEffect(() => {
    void refetch()
  }, [refetch])

  // Read the live atoms at the moment we need to serialize, not at
  // render. Using `useMemo([store])` would have captured the initial
  // YAML at mount because `store` is a stable reference — the dep list
  // never invalidates and updates to stepsAtom/pathsAtom would never
  // refresh the memoized value. e2e caught this on the "save current
  // after adding a step" flow.
  const readCurrentYaml = () => {
    const commands = store.get(commandsAtom)
    const steps = store.get(stepsAtom)
    const paths = store.get(pathsAtom)
    return toYamlStr(steps, paths, commands)
  }

  const onLoad = async (id: string) => {
    try {
      const template = await fetchTemplate(id)
      const commands = store.get(commandsAtom)
      const priorSteps = store.get(stepsAtom)
      const priorPaths = store.get(pathsAtom)
      const result = loadYamlFromText(
        template.yaml,
        commands,
        priorPaths,
      )
      setUndoSnapshot({
        steps: priorSteps,
        paths: priorPaths,
        templateIdAtTimeOfLoad: selectedTemplateId,
      })
      store.set(stepsAtom, result.steps)
      // Cast: pathsAtom's writer expects PathVariable[]; loadYamlFromText
      // returns Variable[] but in practice only emits path-typed entries
      // here. Worker 35 widened the variable union to include
      // dvdCompareId — those land in variablesAtom directly, not via the
      // pathsAtom shim. Narrowing here is the cheapest correct fix.
      store.set(
        pathsAtom,
        result.paths.filter(
          (variable): variable is PathVariable =>
            variable.type === "path",
        ),
      )
      setSelectedTemplateId(id)

      // Clear ?seq= — the server-backed template is now the source
      // of truth for what's on screen.
      const url = new URL(window.location.href)
      url.searchParams.delete("seq")
      window.history.replaceState({}, "", url.toString())
    } catch (error) {
      surfaceActionError(error)
    }
  }

  const onUndoLoad = () => {
    if (undoSnapshot === null) return
    // Casts justified: undoSnapshot stores `unknown[]` so the atoms
    // file can stay free of cross-module type imports; we set them
    // back unchanged to the exact arrays we read out a moment ago.
    store.set(
      stepsAtom,
      undoSnapshot.steps as SequenceItem[],
    )
    store.set(
      pathsAtom,
      undoSnapshot.paths as PathVariable[],
    )
    setSelectedTemplateId(
      undoSnapshot.templateIdAtTimeOfLoad,
    )
    setUndoSnapshot(null)
  }

  const onUpdateFromCurrent = async (id: string) => {
    try {
      await updateTemplate(id, { yaml: readCurrentYaml() })
      await refetch()
    } catch (error) {
      surfaceActionError(error)
    }
  }

  const onRename = async (
    id: string,
    currentName: string,
  ) => {
    const nextName = window.prompt(
      "Rename template:",
      currentName,
    )
    if (nextName === null || nextName.trim().length === 0)
      return
    try {
      const fetched = await fetchTemplate(id)
      await updateTemplate(id, {
        name: nextName.trim(),
        yaml: fetched.yaml,
      })
      await refetch()
    } catch (error) {
      surfaceActionError(error)
    }
  }

  const onEditDescription = async (
    id: string,
    currentDescription: string | undefined,
  ) => {
    const nextDescription = window.prompt(
      "Edit description:",
      currentDescription ?? "",
    )
    if (nextDescription === null) return
    try {
      const fetched = await fetchTemplate(id)
      await updateTemplate(id, {
        description: nextDescription,
        yaml: fetched.yaml,
      })
      await refetch()
    } catch (error) {
      surfaceActionError(error)
    }
  }

  const onDelete = async (
    id: string,
    displayName: string,
  ) => {
    const isConfirmed = window.confirm(
      `Delete template "${displayName}"? This cannot be undone.`,
    )
    if (!isConfirmed) return
    try {
      await deleteTemplate(id)
      if (selectedTemplateId === id)
        setSelectedTemplateId(null)
      await refetch()
    } catch (error) {
      surfaceActionError(error)
    }
  }

  return (
    <section aria-label="Saved Templates" className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Saved Templates
        </h3>
        <button
          type="button"
          onClick={() =>
            setPendingSaveYaml(readCurrentYaml())
          }
          className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded text-white"
        >
          Save current
        </button>
      </div>

      {errorMessage !== null && (
        <p
          role="alert"
          className="text-xs text-red-400 mb-2"
        >
          {errorMessage}
        </p>
      )}

      {templates.length === 0 ? (
        <p className="text-xs text-slate-500">
          No saved templates yet.
        </p>
      ) : (
        <ul className="space-y-1">
          {templates.map((template) => (
            <SavedTemplateRow
              key={template.id}
              template={template}
              isSelected={
                selectedTemplateId === template.id
              }
              onLoad={() => void onLoad(template.id)}
              onUpdateFromCurrent={() =>
                void onUpdateFromCurrent(template.id)
              }
              onRename={() =>
                void onRename(template.id, template.name)
              }
              onEditDescription={() =>
                void onEditDescription(
                  template.id,
                  template.description,
                )
              }
              onDelete={() =>
                void onDelete(template.id, template.name)
              }
            />
          ))}
        </ul>
      )}

      {undoSnapshot !== null && (
        <div
          role="status"
          className="mt-3 p-2 rounded bg-slate-800 border border-slate-700 text-xs text-slate-300 flex items-center justify-between gap-2"
        >
          <span>
            Loaded template — replaces prior sequence.
          </span>
          <button
            type="button"
            onClick={onUndoLoad}
            className="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-100"
          >
            Undo
          </button>
        </div>
      )}

      <SaveTemplateModal
        isOpen={isSaveModalOpen}
        yaml={pendingSaveYaml ?? ""}
        onClose={() => setPendingSaveYaml(null)}
        onSaved={(created) => {
          setSelectedTemplateId(created.id)
          void refetch()
        }}
      />
    </section>
  )
}
