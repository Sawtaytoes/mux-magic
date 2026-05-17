import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { useEffect, useState } from "react"
import { editVariablesModalOpenAtom } from "../../components/EditVariablesModal/editVariablesModalOpenAtom"
import {
  loadModalAutoPastingAtom,
  loadModalOpenAtom,
} from "../../components/LoadModal/loadModalAtom"
import { sequenceRunModalAtom } from "../../components/SequenceRunModal/sequenceRunModalAtom"
import { yamlModalOpenAtom } from "../../components/YamlModal/yamlModalAtom"
import { Z_INDEX } from "../../constants/zIndex"
import { useAutoClipboardLoad } from "../../hooks/useAutoClipboardLoad"
import { useBuilderActions } from "../../hooks/useBuilderActions"
import { Switch } from "../../primitives/Switch/Switch"
import {
  dryRunAtom,
  failureModeAtom,
} from "../../state/dryRunQuery"
import {
  canRedoAtom,
  canUndoAtom,
} from "../../state/historyAtoms"
import { runningAtom } from "../../state/runAtoms"

// ─── Responsive menu state ────────────────────────────────────────────────────

type OpenMenu = "nav" | "controls" | null

const toggleMenu = (
  current: OpenMenu,
  target: OpenMenu,
): OpenMenu => (current === target ? null : target)

// ─── Reusable icon JSX ────────────────────────────────────────────────────────
// Defined once so the pinned cluster (always-visible at ≥481px) and the
// mobile-mirror group (only visible inside the ⋮ menu at ≤480px) can share
// glyphs without duplicating ~25 lines of SVG markup per button.

const collapseAllIcon = (
  <svg
    aria-hidden="true"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-3.5 h-3.5 -rotate-90"
  >
    <polyline points="5,5 10,10 15,5" />
    <polyline points="5,11 10,16 15,11" />
  </svg>
)

const expandAllIcon = (
  <svg
    aria-hidden="true"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-3.5 h-3.5"
  >
    <polyline points="5,5 10,10 15,5" />
    <polyline points="5,11 10,16 15,11" />
  </svg>
)

// ─── PageHeader ───────────────────────────────────────────────────────────────

export const PageHeader = () => {
  const [isDryRun, setIsDryRun] = useAtom(dryRunAtom)
  const [isFailureMode, setIsFailureMode] =
    useAtom(failureModeAtom)
  const isRunning = useAtomValue(runningAtom)
  const isUndoPossible = useAtomValue(canUndoAtom)
  const isRedoPossible = useAtomValue(canRedoAtom)
  const setLoadModalOpen = useSetAtom(loadModalOpenAtom)
  const setIsAutoPasting = useSetAtom(
    loadModalAutoPastingAtom,
  )
  const setYamlModalOpen = useSetAtom(yamlModalOpenAtom)
  const [sequenceRunModal, setSequenceRunModal] = useAtom(
    sequenceRunModalAtom,
  )
  const isBackgroundJobRunning =
    sequenceRunModal.mode === "background"
  const backgroundJobStatus =
    sequenceRunModal.mode === "background"
      ? sequenceRunModal.status
      : null
  const isBackgroundJobActive =
    backgroundJobStatus === "pending" ||
    backgroundJobStatus === "running"
  const backgroundBadgeLabel =
    backgroundJobStatus === "completed"
      ? "Sequence completed"
      : backgroundJobStatus === "failed"
        ? "Sequence failed"
        : backgroundJobStatus === "cancelled"
          ? "Sequence cancelled"
          : backgroundJobStatus === "skipped"
            ? "Sequence skipped"
            : "1 background job"
  const backgroundBadgeTitle = isBackgroundJobActive
    ? "1 background job running — click to re-open"
    : `${backgroundBadgeLabel} — click to re-open`
  const backgroundBadgeClass =
    backgroundJobStatus === "completed"
      ? "bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border-emerald-500/40"
      : backgroundJobStatus === "failed"
        ? "bg-red-500/20 hover:bg-red-500/35 text-red-300 border-red-500/40"
        : backgroundJobStatus === "cancelled" ||
            backgroundJobStatus === "skipped"
          ? "bg-slate-500/20 hover:bg-slate-500/35 text-slate-300 border-slate-500/40"
          : "bg-sky-500/20 hover:bg-sky-500/35 text-sky-400 border-sky-500/40"
  const setEditVariablesModalOpen = useSetAtom(
    editVariablesModalOpenAtom,
  )

  const actions = useBuilderActions()
  const autoClipboardLoad = useAutoClipboardLoad()

  const [openMenu, setOpenMenu] = useState<OpenMenu>(null)
  const [isYamlCopied, setIsYamlCopied] = useState(false)
  const [isYamlPasted, setIsYamlPasted] = useState(false)

  // ─── Click-outside dismissal for responsive menus ─────────────────────────
  useEffect(() => {
    if (!openMenu) return
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Element | null
      if (
        target?.closest(
          "#page-nav-toggle, #page-controls-toggle, .page-menu",
        )
      )
        return
      setOpenMenu(null)
    }
    document.addEventListener("mousedown", handleMouseDown)
    return () =>
      document.removeEventListener(
        "mousedown",
        handleMouseDown,
      )
  }, [openMenu])

  // ─── Esc key: close menus ────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      setOpenMenu(null)
    }
    document.addEventListener("keydown", handleKeyDown)
    return () =>
      document.removeEventListener("keydown", handleKeyDown)
  }, [])

  const toggleDryRun = () => {
    setIsDryRun(!isDryRun)
  }

  const toggleFailureMode = () => {
    setIsFailureMode(!isFailureMode)
  }

  return (
    <div
      id="page-header"
      className="shrink-0 border-b border-slate-700 bg-slate-900"
      style={{ zIndex: Z_INDEX.sticky }}
    >
      <div className="page-header-inner flex items-center px-4 py-3 gap-3">
        {/* Responsive nav toggle */}
        <button
          type="button"
          id="page-nav-toggle"
          title="Menu"
          aria-label="Open menu"
          className="page-menu-toggle w-7 h-7 items-center justify-center rounded text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 transition-colors"
          onClick={() =>
            setOpenMenu((prev) => toggleMenu(prev, "nav"))
          }
        >
          <svg
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4"
          >
            <path d="M4 6h16" />
            <path d="M4 12h16" />
            <path d="M4 18h16" />
          </svg>
        </button>

        {/* Title */}
        <h1 className="text-lg font-bold tracking-tight">
          <a
            href="/"
            className="text-slate-100 hover:text-blue-300 transition-colors"
          >
            Sequence Builder
          </a>
        </h1>

        {/* Background job badge */}
        {isBackgroundJobRunning && (
          <button
            type="button"
            id="background-job-badge"
            onClick={() =>
              setSequenceRunModal((prev) =>
                prev.mode === "background"
                  ? { ...prev, mode: "open" }
                  : prev,
              )
            }
            className={`text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded active:scale-95 self-center transition-all border ${backgroundBadgeClass}`}
            title={backgroundBadgeTitle}
          >
            {backgroundBadgeLabel}
          </button>
        )}

        {/* Dry-run badge */}
        {isDryRun && (
          <button
            type="button"
            id="dry-run-badge"
            onClick={toggleDryRun}
            className={`text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded active:scale-95 self-center transition-all border ${
              isFailureMode
                ? "bg-red-500/20 hover:bg-red-500/35 text-red-400 border-red-500/40"
                : "bg-amber-500/20 hover:bg-amber-500/35 text-amber-400 border-amber-500/40"
            }`}
            title={
              isFailureMode
                ? "Dry run ON (failure mode) — click to disable"
                : "Dry run ON — click to disable"
            }
          >
            DRY RUN
          </button>
        )}

        {/* Nav menu (New Sequence, Jobs link) */}
        <div
          id="page-actions-nav"
          aria-hidden={openMenu !== "nav"}
          className={`page-menu page-menu-nav${openMenu === "nav" ? " open" : ""}`}
        >
          <div className="page-menu-group">
            <button
              type="button"
              onClick={() => {
                actions.startNew()
                setOpenMenu(null)
              }}
              title="Clear the current sequence and start fresh (Ctrl+Z to undo)"
              className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded font-medium border border-slate-600"
            >
              New Sequence
            </button>
          </div>
          <span className="page-menu-sep w-px h-6 bg-slate-700 mx-1" />
          <div className="page-menu-group">
            <a
              href="/"
              className="text-xs text-slate-400 hover:text-slate-300"
            >
              Jobs ↗
            </a>
          </div>
        </div>

        {/* Pinned: variables + undo/redo + collapse/expand.
            role="toolbar" + aria-label make this a real accessibility
            landmark — also lets tests scope queries via
            `within(getByRole("toolbar"))` so the Variables button here
            is distinguishable from its duplicate inside the ⋮ menu. */}
        <div
          id="header-pinned"
          role="toolbar"
          aria-label="Header actions"
          className="ml-auto flex items-center gap-1"
        >
          <button
            type="button"
            id="variables-btn"
            onClick={() => setEditVariablesModalOpen(true)}
            title="Edit sequence variables"
            aria-label="Variables"
            className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-2 py-1.5 rounded border border-slate-600 lg:hidden"
          >
            Variables
          </button>
          <span className="w-px h-4 bg-slate-700 mx-0.5 lg:hidden" />
          <button
            type="button"
            id="undo-btn"
            onClick={() => void actions.undo()}
            title="Undo (Ctrl+Z)"
            disabled={!isUndoPossible}
            className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 disabled:opacity-30 disabled:hover:bg-slate-700 px-2 py-1.5 rounded border border-slate-600 w-7"
          >
            ↶
          </button>
          <button
            type="button"
            id="redo-btn"
            onClick={() => void actions.redo()}
            title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
            disabled={!isRedoPossible}
            className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 disabled:opacity-30 disabled:hover:bg-slate-700 px-2 py-1.5 rounded border border-slate-600 w-7"
          >
            ↷
          </button>
          <span className="w-px h-4 bg-slate-700 mx-0.5" />
          <button
            type="button"
            onClick={() => actions.setAllCollapsed(true)}
            title="Collapse every step + group"
            className="w-7 h-7 flex items-center justify-center rounded text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 border border-slate-600 transition-colors"
          >
            {collapseAllIcon}
          </button>
          <button
            type="button"
            onClick={() => actions.setAllCollapsed(false)}
            title="Expand every step + group"
            className="w-7 h-7 flex items-center justify-center rounded text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 border border-slate-600 transition-colors"
          >
            {expandAllIcon}
          </button>
          <span className="w-px h-6 bg-slate-700 mx-1" />
        </div>

        {/* Controls menu */}
        <div
          id="page-actions-controls"
          aria-hidden={openMenu !== "controls"}
          className={`page-menu page-menu-controls${openMenu === "controls" ? " open" : ""}`}
        >
          {/* Mirror of #header-pinned for viewports where that cluster
              is hidden (≤480px). CSS in builderStyles.css hides this
              group at ≥481px so it never duplicates the pinned bar. */}
          <div className="page-menu-group page-menu-mobile-mirror">
            <button
              type="button"
              onClick={() => {
                setEditVariablesModalOpen(true)
                setOpenMenu(null)
              }}
              title="Edit sequence variables"
              className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded font-medium border border-slate-600"
            >
              Variables
            </button>
            <div className="page-menu-row">
              <button
                type="button"
                onClick={() => void actions.undo()}
                title="Undo (Ctrl+Z)"
                disabled={!isUndoPossible}
                className="text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 disabled:opacity-30 disabled:hover:bg-slate-700 px-2 py-1.5 rounded border border-slate-600"
              >
                ↶
              </button>
              <button
                type="button"
                onClick={() => void actions.redo()}
                title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
                disabled={!isRedoPossible}
                className="text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 disabled:opacity-30 disabled:hover:bg-slate-700 px-2 py-1.5 rounded border border-slate-600"
              >
                ↷
              </button>
            </div>
            <div className="page-menu-row">
              <button
                type="button"
                onClick={() =>
                  actions.setAllCollapsed(true)
                }
                title="Collapse every step + group"
                className="flex items-center justify-center px-2 py-1.5 rounded text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 border border-slate-600 transition-colors"
              >
                {collapseAllIcon}
              </button>
              <button
                type="button"
                onClick={() =>
                  actions.setAllCollapsed(false)
                }
                title="Expand every step + group"
                className="flex items-center justify-center px-2 py-1.5 rounded text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 border border-slate-600 transition-colors"
              >
                {expandAllIcon}
              </button>
            </div>
          </div>

          <span className="page-menu-sep page-menu-mobile-mirror w-px h-6 bg-slate-700 mx-1" />

          {/* Dry run + run actions */}
          <div className="page-menu-group">
            <button
              type="button"
              id="dry-run-btn"
              onClick={toggleDryRun}
              className="flex items-center justify-between gap-2 text-xs text-slate-300 cursor-pointer select-none"
              title="Toggle dry-run mode — simulate commands without touching files"
            >
              <span className="leading-none">Dry Run</span>
              <Switch
                isOn={isDryRun}
                activeTrackClass="bg-amber-500 border-amber-400"
              />
            </button>

            {isDryRun && (
              <button
                type="button"
                id="failure-mode-btn"
                onClick={toggleFailureMode}
                className="flex items-center justify-between gap-2 text-xs text-red-300 cursor-pointer select-none"
                title="Simulate failures — all commands will fail (dry-run only)"
              >
                <span className="leading-none">
                  Simulate Failures
                </span>
                <Switch
                  isOn={isFailureMode}
                  activeTrackClass="bg-red-600 border-red-500"
                />
              </button>
            )}

            <button
              type="button"
              id="run-btn"
              onClick={() => void actions.runViaApi()}
              disabled={isRunning}
              title="Run the entire sequence via the server-side sequence API (/sequences/run)"
              className="text-xs bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white px-3 py-1.5 rounded font-medium"
            >
              ▶ Run Sequence
            </button>
            <button
              type="button"
              id="run-api-btn"
              onClick={() => void actions.runViaApi()}
              disabled={isRunning}
              title="POST the YAML to /sequences/run as one umbrella job (server-side orchestration)"
              className="text-xs bg-sky-700 hover:bg-sky-600 disabled:opacity-40 text-white px-3 py-1.5 rounded font-medium"
            >
              ▶ Run via API
            </button>
          </div>

          <span className="page-menu-sep w-px h-6 bg-slate-700 mx-1" />

          <div className="page-menu-group">
            <div className="page-menu-row">
              {/* Load YAML */}
              <button
                type="button"
                id="load-btn"
                onClick={async () => {
                  // Open the modal synchronously so LoadModal's paste
                  // listener attaches THIS tick — required for synthetic
                  // paste events (e.g., e2e tests) and for Ctrl+V that
                  // arrives before clipboard.readText() resolves. Setting
                  // both atoms in the same event-handler batch keeps the
                  // Modal primitive's first commit invisible: LoadModal
                  // gates its visible <Modal isOpen> on
                  // `isOpen && !isAutoPasting`, so no flash.
                  setLoadModalOpen(true)
                  setIsAutoPasting(true)
                  try {
                    const isLoaded =
                      await autoClipboardLoad()
                    if (isLoaded) {
                      setLoadModalOpen(false)
                      setIsYamlPasted(true)
                      setTimeout(
                        () => setIsYamlPasted(false),
                        1500,
                      )
                    }
                  } finally {
                    setIsAutoPasting(false)
                  }
                }}
                title="Load YAML"
                className={`w-7 h-7 flex items-center justify-center rounded border transition-colors ${isYamlPasted ? "text-emerald-400 bg-slate-700 border-emerald-500/50" : "text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border-slate-700 hover:border-slate-600"}`}
              >
                {isYamlPasted ? (
                  <span className="text-xs font-bold">
                    ✓
                  </span>
                ) : (
                  <svg
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-4 h-4"
                  >
                    <path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5" />
                    <path d="M16.5 7.5 12 3m0 0L7.5 7.5M12 3v13.5" />
                  </svg>
                )}
              </button>
              {/* Copy YAML */}
              <button
                type="button"
                id="copy-btn"
                onClick={async () => {
                  await actions.copyYaml()
                  setIsYamlCopied(true)
                  setTimeout(
                    () => setIsYamlCopied(false),
                    1500,
                  )
                }}
                title="Copy YAML"
                className={`w-7 h-7 flex items-center justify-center rounded border transition-colors ${isYamlCopied ? "text-emerald-400 bg-slate-700 border-emerald-500/50" : "text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border-slate-700 hover:border-slate-600"}`}
              >
                {isYamlCopied ? (
                  <span className="text-xs font-bold">
                    ✓
                  </span>
                ) : (
                  <svg
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-4 h-4"
                  >
                    <path d="M15.75 17.25v3a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-9a1.5 1.5 0 0 1 1.5-1.5H8.25" />
                    <rect
                      x="8.25"
                      y="2.25"
                      width="12"
                      height="15"
                      rx="1.5"
                      ry="1.5"
                    />
                  </svg>
                )}
              </button>
              {/* View YAML */}
              <button
                type="button"
                onClick={() => setYamlModalOpen(true)}
                title="View YAML"
                className="w-7 h-7 flex items-center justify-center rounded text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 transition-colors"
              >
                <svg
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4"
                >
                  <path d="m17.25 6.75 4.5 5.25-4.5 5.25" />
                  <path d="m6.75 17.25-4.5-5.25 4.5-5.25" />
                  <path d="m14.25 4.5-4.5 15" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Responsive controls toggle */}
        <button
          type="button"
          id="page-controls-toggle"
          onClick={() =>
            setOpenMenu((prev) =>
              toggleMenu(prev, "controls"),
            )
          }
          title="Sequence actions"
          aria-label="Sequence actions"
          className="page-menu-toggle w-7 h-7 items-center justify-center rounded text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-base leading-none"
        >
          ⋮
        </button>
      </div>
    </div>
  )
}
