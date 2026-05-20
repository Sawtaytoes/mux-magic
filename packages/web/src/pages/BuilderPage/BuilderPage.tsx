import { useStore } from "jotai"
import { useHydrateAtoms } from "jotai/utils"
import { lazy, Suspense, useEffect, useRef } from "react"

import { COMMANDS } from "../../commands/commands"
import { CommandPicker } from "../../components/CommandPicker/CommandPicker"
import { EnumPicker } from "../../components/EnumPicker/EnumPicker"
import { LinkPicker } from "../../components/LinkPicker/LinkPicker"
import { PageHeader } from "../../components/PageHeader/PageHeader"
import { PathPicker } from "../../components/PathPicker/PathPicker"
import { VariablesSidebar } from "../../components/VariablesSidebar/VariablesSidebar"
import { useBuilderKeyboard } from "../../hooks/useBuilderKeyboard"
import { usePageTitle } from "../../hooks/usePageTitle"
import { decodeSeqJsonParam } from "../../jobs/decodeSeqJsonParam"
import { decodeSeqParam } from "../../jobs/decodeSeqParam"
import { encodeSeqJsonParam } from "../../jobs/encodeSeqJsonParam"
import { commandsAtom } from "../../state/commandsAtom"
import { pathsAtom } from "../../state/pathsAtom"
import { stepsAtom } from "../../state/stepsAtom"
import { variablesAtom } from "../../state/variablesAtom"
import { BuilderSequenceList } from "../BuilderSequenceList/BuilderSequenceList"

// Each modal is atom-gated to closed-by-default, so they never appear on
// first paint. Lazy-loading them keeps `yamlCodec` + `js-yaml` + the per-modal
// component code out of the main chunk; rolldown emits `<link rel=
// "modulepreload">` for each so the user-perceived open latency stays
// imperceptible. The `.then((mod) => ({ default: mod.X }))` adapter exists
// because every modal is a named export (project convention — see worker 07)
// but React.lazy only accepts a default export.
const LoadModal = lazy(() =>
  import("../../components/LoadModal/LoadModal").then(
    (mod) => ({ default: mod.LoadModal }),
  ),
)
const YamlModal = lazy(() =>
  import("../../components/YamlModal/YamlModal").then(
    (mod) => ({ default: mod.YamlModal }),
  ),
)
const SequenceRunModal = lazy(() =>
  import(
    "../../components/SequenceRunModal/SequenceRunModal"
  ).then((mod) => ({ default: mod.SequenceRunModal })),
)
const SmartMatchModal = lazy(() =>
  import(
    "../../components/SmartMatchModal/SmartMatchModal"
  ).then((mod) => ({ default: mod.SmartMatchModal })),
)
const FileExplorerModal = lazy(() =>
  import(
    "../../components/FileExplorerModal/FileExplorerModal"
  ).then((mod) => ({ default: mod.FileExplorerModal })),
)
const EditVariablesModal = lazy(() =>
  import(
    "../../components/EditVariablesModal/EditVariablesModal"
  ).then((mod) => ({ default: mod.EditVariablesModal })),
)
const CommandHelpModal = lazy(() =>
  import(
    "../../components/CommandHelpModal/CommandHelpModal"
  ).then((mod) => ({ default: mod.CommandHelpModal })),
)
const LookupModal = lazy(() =>
  import("../../components/LookupModal/LookupModal").then(
    (mod) => ({ default: mod.LookupModal }),
  ),
)
const PromptModal = lazy(() =>
  import("../../components/PromptModal/PromptModal").then(
    (mod) => ({ default: mod.PromptModal }),
  ),
)
const AudioPreviewModal = lazy(() =>
  import(
    "../../components/AudioPreviewModal/AudioPreviewModal"
  ).then((mod) => ({ default: mod.AudioPreviewModal })),
)
const ImagePreviewModal = lazy(() =>
  import(
    "../../components/ImagePreviewModal/ImagePreviewModal"
  ).then((mod) => ({ default: mod.ImagePreviewModal })),
)
const VideoPreviewModal = lazy(() =>
  import(
    "../../components/VideoPreviewModal/VideoPreviewModal"
  ).then((mod) => ({ default: mod.VideoPreviewModal })),
)

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

  // Cached yamlCodec module — populated by the dynamic import in either
  // useEffect below, whichever resolves first. Worker 79 moved `js-yaml`
  // out of the main chunk; both effects share the dynamic import via
  // ESM's module cache so only one network/parse round-trip happens.
  type YamlCodecModule =
    typeof import("../../jobs/yamlCodec")
  const codecRef = useRef<YamlCodecModule | null>(null)

  useEffect(() => {
    void (async () => {
      const params = new URLSearchParams(
        window.location.search,
      )
      const decoded =
        decodeSeqJsonParam(params.get("seqJson")) ??
        decodeSeqParam(params.get("seq"))
      if (!decoded) return

      const codec =
        codecRef.current ??
        (await import("../../jobs/yamlCodec"))
      codecRef.current = codec

      try {
        const result = codec.loadYamlFromText(
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
    })()
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
  //
  // Worker 79 made `yamlCodec` lazy so `js-yaml` lands in an async chunk
  // shared with the modal subtree. We kick off the dynamic import on
  // mount and cache the module in `codecRef`; the first keystroke before
  // the import resolves is the only writeUrl call that no-ops, and the
  // very next change re-syncs the URL. In practice the module resolves
  // sub-frame so this is invisible.
  useEffect(() => {
    if (!codecRef.current) {
      void import("../../jobs/yamlCodec").then((module) => {
        codecRef.current = module
      })
    }

    const writeUrl = () => {
      const codec = codecRef.current
      if (!codec) return
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
          codec.buildSequenceObject(steps, paths, commands),
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

      {/* Modals — lazy-loaded; each is atom-gated to closed-by-default so
          `null` is the correct Suspense fallback (nothing renders until
          the user actually opens one and the chunk resolves). */}
      <Suspense fallback={null}>
        <EditVariablesModal />
        <YamlModal />
        <LoadModal />
        <CommandHelpModal />
        <PromptModal />
        <SequenceRunModal />
        <LookupModal />
        <FileExplorerModal />
        <VideoPreviewModal />
        <AudioPreviewModal />
        <ImagePreviewModal />
        <SmartMatchModal />
      </Suspense>

      {/* Pickers — render via createPortal into document.body */}
      <CommandPicker />
      <EnumPicker />
      <LinkPicker />
      <PathPicker />
    </div>
  )
}
