import { useStore } from "jotai"
import { useHydrateAtoms } from "jotai/utils"
import { useEffect } from "react"

import { COMMANDS } from "../../commands/commands"
import { ApiRunModal } from "../../components/ApiRunModal/ApiRunModal"
import { CommandHelpModal } from "../../components/CommandHelpModal/CommandHelpModal"
import { CommandPicker } from "../../components/CommandPicker/CommandPicker"
import { EnumPicker } from "../../components/EnumPicker/EnumPicker"
import { FileExplorerModal } from "../../components/FileExplorerModal/FileExplorerModal"
import { LinkPicker } from "../../components/LinkPicker/LinkPicker"
import { LoadModal } from "../../components/LoadModal/LoadModal"
import { LookupModal } from "../../components/LookupModal/LookupModal"
import { PageHeader } from "../../components/PageHeader/PageHeader"
import { PathPicker } from "../../components/PathPicker/PathPicker"
import { PromptModal } from "../../components/PromptModal/PromptModal"
import { YamlModal } from "../../components/YamlModal/YamlModal"
import { useBuilderKeyboard } from "../../hooks/useBuilderKeyboard"
import { decodeSeqParam } from "../../jobs/decodeSeqParam"
import { loadYamlFromText } from "../../jobs/loadYaml"
import { commandsAtom } from "../../state/commandsAtom"
import { pathsAtom } from "../../state/pathsAtom"
import {
  stepCounterAtom,
  stepsAtom,
} from "../../state/stepsAtom"
import { BuilderPathVarList } from "../BuilderPathVarList/BuilderPathVarList"
import { BuilderSequenceList } from "../BuilderSequenceList/BuilderSequenceList"

// ─── BuilderPage ──────────────────────────────────────────────────────────────

export const BuilderPage = () => {
  useBuilderKeyboard()
  useHydrateAtoms([[commandsAtom, COMMANDS]])

  // Hydrate atoms from ?seq= query param on mount. Restores the legacy
  // shareable-URL flow: copy a URL with a base64-encoded YAML body and
  // anyone who opens it gets the same sequence pre-loaded. Both legacy
  // YAML payloads and the current React JSON payload (buildBuilderUrl)
  // parse through loadYamlFromText cleanly because JSON is valid YAML.
  //
  // Reading atom values via `store.get(...)` inside the effect (rather
  // than `useAtomValue` at the component top level) keeps the effect's
  // dep list stable — `store` is a stable reference, so the effect runs
  // exactly once on mount, never re-runs when atom values change.
  const store = useStore()

  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search,
    )
    const decoded = decodeSeqParam(params.get("seq"))
    if (!decoded) return

    try {
      const result = loadYamlFromText(
        decoded,
        store.get(commandsAtom),
        store.get(pathsAtom),
        store.get(stepCounterAtom),
      )
      store.set(stepsAtom, result.steps)
      store.set(pathsAtom, result.paths)
      store.set(stepCounterAtom, result.stepCounter)

      // Intentionally NOT stripping ?seq= from the URL. Earlier code did so
      // (to prevent refresh from clobbering edits) but that caused a worse
      // regression: refresh removed both the query string AND the loaded
      // YAML, leaving an empty builder. The acceptable trade-off here is
      // "refresh re-loads original URL state and discards post-load edits"
      // — still better than "refresh loses everything." The right long-term
      // fix is live URL syncing (encode current state into ?seq= on every
      // atom change) which is its own scoped feature.
    } catch (error) {
      // Invalid YAML shouldn't crash the page — the user can paste a
      // corrected version via LoadModal. Surface in console for debugging.
      console.error(
        "Failed to load sequence from ?seq= URL parameter:",
        error,
      )
    }
  }, [store])

  return (
    <div
      className="flex flex-col bg-slate-900 text-slate-200"
      style={{ height: "100dvh", overflow: "hidden" }}
    >
      <PageHeader />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <BuilderPathVarList />
          <BuilderSequenceList />
        </div>
      </main>

      {/* Modals */}
      <YamlModal />
      <LoadModal />
      <CommandHelpModal />
      <PromptModal />
      <ApiRunModal />
      <LookupModal />
      <FileExplorerModal />

      {/* Pickers — render via createPortal into document.body */}
      <CommandPicker />
      <EnumPicker />
      <LinkPicker />
      <PathPicker />
    </div>
  )
}
