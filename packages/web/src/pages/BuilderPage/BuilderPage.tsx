import { useStore } from "jotai"
import { useHydrateAtoms } from "jotai/utils"
import { useEffect } from "react"

import { COMMANDS } from "../../commands/commands"
import { CommandHelpModal } from "../../components/CommandHelpModal/CommandHelpModal"
import { CommandPicker } from "../../components/CommandPicker/CommandPicker"
import { EditVariablesModal } from "../../components/EditVariablesModal/EditVariablesModal"
import { EnumPicker } from "../../components/EnumPicker/EnumPicker"
import { FileExplorerModal } from "../../components/FileExplorerModal/FileExplorerModal"
import { LinkPicker } from "../../components/LinkPicker/LinkPicker"
import { LoadModal } from "../../components/LoadModal/LoadModal"
import { LookupModal } from "../../components/LookupModal/LookupModal"
import { PageHeader } from "../../components/PageHeader/PageHeader"
import { PathPicker } from "../../components/PathPicker/PathPicker"
import { PromptModal } from "../../components/PromptModal/PromptModal"
import { SequenceRunModal } from "../../components/SequenceRunModal/SequenceRunModal"
import { VariablesSidebar } from "../../components/VariablesSidebar/VariablesSidebar"
import { YamlModal } from "../../components/YamlModal/YamlModal"
import { useBuilderKeyboard } from "../../hooks/useBuilderKeyboard"
import { usePageTitle } from "../../hooks/usePageTitle"
import { decodeSeqParam } from "../../jobs/decodeSeqParam"
import { encodeSeqParam } from "../../jobs/encodeSeqParam"
import {
  loadYamlFromText,
  toYamlStr,
} from "../../jobs/yamlCodec"
import { commandsAtom } from "../../state/commandsAtom"
import { pathsAtom } from "../../state/pathsAtom"
import { stepsAtom } from "../../state/stepsAtom"
import { variablesAtom } from "../../state/variablesAtom"
import { BuilderSequenceList } from "../BuilderSequenceList/BuilderSequenceList"

// ─── BuilderPage ──────────────────────────────────────────────────────────────

export const BuilderPage = () => {
  usePageTitle("Sequence Builder")
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
      )
      store.set(stepsAtom, result.steps)
      // Write to variablesAtom so non-path types loaded from ?seq= survive
      // (worker 35: dvdCompareId, future TMDB/AniDB).
      store.set(variablesAtom, result.paths)

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

  // Live URL syncing: on every change to steps / paths, synchronously
  // re-encode the current YAML into ?seq= and replace the URL. Writing
  // synchronously (no setTimeout debounce) is the only race-free way to
  // guarantee the URL reflects the latest keystroke when the user
  // refreshes immediately after typing. Earlier versions used a 250ms
  // debounce + beforeunload/pagehide flush, but that combination still
  // dropped values when the user hit F5 inside the debounce window —
  // beforeunload fired before the React commit / setTimeout queue had a
  // pending write to flush.
  //
  // toYamlStr + history.replaceState are microsecond-scale operations
  // (sub-1ms even for ~100-step sequences), so doing them per keystroke
  // is fine. Uses `store.sub` rather than `useAtomValue` so BuilderPage
  // itself doesn't re-render on every atom change.
  //
  // beforeunload/pagehide listeners stay as safety nets in case any
  // future code path defers an atom write into a microtask or animation
  // frame; they're no-ops today because writeUrl already ran on the
  // change that triggered the unload.
  useEffect(() => {
    const writeUrl = () => {
      const commands = store.get(commandsAtom)
      if (!commands || Object.keys(commands).length === 0) {
        return
      }
      const steps = store.get(stepsAtom)
      // ?seq= captures all variable types (path + dvdCompareId + future)
      // so URL sharing round-trips a complete sequence.
      const paths = store.get(variablesAtom)
      const hasContent =
        steps.length > 0 ||
        paths.some((variable) => variable.value)
      const url = new URL(window.location.href)
      if (hasContent) {
        const yaml = toYamlStr(steps, paths, commands)
        url.searchParams.set("seq", encodeSeqParam(yaml))
      } else {
        url.searchParams.delete("seq")
      }
      window.history.replaceState({}, "", url.toString())
    }

    const unsubSteps = store.sub(stepsAtom, writeUrl)
    const unsubPaths = store.sub(variablesAtom, writeUrl)
    window.addEventListener("beforeunload", writeUrl)
    window.addEventListener("pagehide", writeUrl)

    return () => {
      unsubSteps()
      unsubPaths()
      window.removeEventListener("beforeunload", writeUrl)
      window.removeEventListener("pagehide", writeUrl)
    }
  }, [store])

  return (
    <div
      className="flex flex-col bg-slate-900 text-slate-200"
      style={{ height: "100dvh", overflow: "hidden" }}
    >
      <PageHeader />

      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-4">
            <BuilderSequenceList />
          </div>
        </main>
        <VariablesSidebar />
      </div>

      {/* Modals */}
      <EditVariablesModal />
      <YamlModal />
      <LoadModal />
      <CommandHelpModal />
      <PromptModal />
      <SequenceRunModal />
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
