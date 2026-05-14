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
import { decodeSeqParam } from "../../jobs/decodeSeqParam"
import { encodeSeqParam } from "../../jobs/encodeSeqParam"
import {
  loadYamlFromText,
  toYamlStr,
} from "../../jobs/yamlCodec"
import { commandsAtom } from "../../state/commandsAtom"
import { pathsAtom } from "../../state/pathsAtom"
import {
  stepCounterAtom,
  stepsAtom,
} from "../../state/stepsAtom"
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

  // Live URL syncing: on every change to steps / paths, re-encode the
  // current YAML into ?seq= and replace the URL. Makes the URL a live
  // source of truth — refreshing keeps state, bookmarks are restorable,
  // copying the URL shares the working sequence.
  //
  // Uses `store.sub` rather than `useAtomValue` so BuilderPage itself
  // doesn't re-render on every atom change. The debounce keeps URL writes
  // out of the keystroke hot path; 250ms is fast enough that bookmarking
  // feels immediate.
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null =
      null

    const writeUrl = () => {
      const commands = store.get(commandsAtom)
      if (!commands || Object.keys(commands).length === 0) {
        return
      }
      const steps = store.get(stepsAtom)
      const paths = store.get(pathsAtom)
      const hasContent =
        steps.length > 0 ||
        paths.some((pathVariable) => pathVariable.value)
      const url = new URL(window.location.href)
      if (hasContent) {
        const yaml = toYamlStr(steps, paths, commands)
        url.searchParams.set("seq", encodeSeqParam(yaml))
      } else {
        url.searchParams.delete("seq")
      }
      window.history.replaceState({}, "", url.toString())
    }

    const scheduleWrite = () => {
      if (timeoutId !== null) clearTimeout(timeoutId)
      timeoutId = setTimeout(writeUrl, 250)
    }

    // Flush any pending debounced write synchronously. Without this, a
    // refresh / tab close within the 250ms debounce window loses the
    // user's most recent edit (the param change made it into atoms but
    // never reached the URL). Mirrors the legacy
    // public/builder/js/sequence-editor.js flushScheduledUpdateUrl
    // pattern that solved the same race for typed inputs.
    //
    // Why both events: beforeunload fires reliably on Chromium for
    // refresh/close, but Firefox is increasingly stingy about it
    // (especially when the page wasn't interacted with) and Safari often
    // skips it on mobile entirely. pagehide fires consistently across
    // all engines including bfcache restores, so we bind both. Either
    // firing is safe — the second is a no-op because timeoutId is
    // cleared after the first flush.
    const flushPendingWrite = () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
        timeoutId = null
        writeUrl()
      }
    }

    const unsubSteps = store.sub(stepsAtom, scheduleWrite)
    const unsubPaths = store.sub(pathsAtom, scheduleWrite)
    window.addEventListener(
      "beforeunload",
      flushPendingWrite,
    )
    window.addEventListener("pagehide", flushPendingWrite)

    return () => {
      if (timeoutId !== null) clearTimeout(timeoutId)
      unsubSteps()
      unsubPaths()
      window.removeEventListener(
        "beforeunload",
        flushPendingWrite,
      )
      window.removeEventListener(
        "pagehide",
        flushPendingWrite,
      )
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
