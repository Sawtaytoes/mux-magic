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
import { VideoPreviewModal } from "../../components/VideoPreviewModal/VideoPreviewModal"
import { YamlModal } from "../../components/YamlModal/YamlModal"
import { useBuilderKeyboard } from "../../hooks/useBuilderKeyboard"
import { usePageTitle } from "../../hooks/usePageTitle"
import { decodeSeqJsonParam } from "../../jobs/decodeSeqJsonParam"
import { decodeSeqParam } from "../../jobs/decodeSeqParam"
import { encodeSeqJsonParam } from "../../jobs/encodeSeqJsonParam"
import {
  buildSequenceObject,
  loadYamlFromText,
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

  // Hydrate atoms from the URL on mount. Two formats are accepted:
  //   - ?seqJson= (worker 43+): minified JSON in base64url, no padding
  //   - ?seq=     (legacy):     YAML or JSON in standard base64
  // ?seqJson= wins when both are present so a forwarded share URL doesn't
  // race itself. Both decoded payloads feed loadYamlFromText cleanly
  // because JSON is valid YAML.
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
    const decoded =
      decodeSeqJsonParam(params.get("seqJson")) ??
      decodeSeqParam(params.get("seq"))
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

      // Intentionally NOT stripping the query param from the URL. Earlier
      // code did so (to prevent refresh from clobbering edits) but that
      // caused a worse regression: refresh removed both the query string
      // AND the loaded YAML, leaving an empty builder. The acceptable
      // trade-off is "refresh re-loads original URL state and discards
      // post-load edits" — still better than "refresh loses everything."
      // Live URL syncing in the writer effect below makes that trade-off
      // moot in practice.
    } catch (error) {
      // Invalid payload shouldn't crash the page — the user can paste a
      // corrected version via LoadModal. Surface in console for debugging.
      console.error(
        "Failed to load sequence from URL parameter:",
        error,
      )
    }
  }, [store])

  // Live URL syncing: on every change to steps / paths, synchronously
  // re-encode the current sequence into ?seqJson= and replace the URL.
  // Writing synchronously (no setTimeout debounce) is the only race-free
  // way to guarantee the URL reflects the latest keystroke when the user
  // refreshes immediately after typing. Earlier versions used a 250ms
  // debounce + beforeunload/pagehide flush, but that combination still
  // dropped values when the user hit F5 inside the debounce window —
  // beforeunload fired before the React commit / setTimeout queue had a
  // pending write to flush.
  //
  // Worker 43 swapped the encoding: minified JSON + base64url under
  // ?seqJson= replaces YAML + standard base64 under ?seq=. JSON is ~20%
  // smaller than the equivalent YAML and base64url drops `=` padding plus
  // the `+`/`/` chars that `encodeURIComponent` had to escape. ?seq= is
  // also cleared so a stale legacy param can't shadow the new one. The
  // mount-time reader prefers ?seqJson= so dispatch stays unambiguous.
  //
  // JSON.stringify + history.replaceState are microsecond-scale operations
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
      // ?seqJson= captures all variable types (path + dvdCompareId + future)
      // so URL sharing round-trips a complete sequence.
      const paths = store.get(variablesAtom)
      const hasContent =
        steps.length > 0 ||
        paths.some((variable) => variable.value)
      const url = new URL(window.location.href)
      if (hasContent) {
        const json = JSON.stringify(
          buildSequenceObject(steps, paths, commands),
        )
        url.searchParams.set(
          "seqJson",
          encodeSeqJsonParam(json),
        )
      } else {
        url.searchParams.delete("seqJson")
      }
      // Always clear any legacy ?seq= so it can't shadow ?seqJson= on
      // refresh. Safe to call unconditionally — delete on a missing key
      // is a no-op.
      url.searchParams.delete("seq")
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
      <VideoPreviewModal />

      {/* Pickers — render via createPortal into document.body */}
      <CommandPicker />
      <EnumPicker />
      <LinkPicker />
      <PathPicker />
    </div>
  )
}
