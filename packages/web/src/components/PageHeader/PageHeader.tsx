import {
  Button,
  IconButton,
  Switch,
  UnstyledLink,
} from "@charcuterie/ui"
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
import {
  dryRunAtom,
  failureModeAtom,
} from "../../state/dryRunQuery"
import {
  canRedoAtom,
  canUndoAtom,
} from "../../state/historyAtoms"
import { runningAtom } from "../../state/runAtoms"
import { SchemeMenuButton } from "../SchemeMenuButton/SchemeMenuButton"

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
      ? "bg-intent-success-surface hover:bg-intent-success-surface-hover text-intent-success-content border-intent-success-border"
      : backgroundJobStatus === "failed"
        ? "bg-intent-danger-surface hover:bg-intent-danger-surface-hover text-intent-danger-content border-intent-danger-border"
        : backgroundJobStatus === "cancelled" ||
            backgroundJobStatus === "skipped"
          ? "bg-intent-neutral-surface hover:bg-intent-neutral-surface-hover text-intent-neutral-content border-intent-neutral-border"
          : "bg-intent-info-surface hover:bg-intent-info-surface-hover text-intent-info-content border-intent-info-border"
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

  return (
    <div
      id="page-header"
      className="shrink-0 border-b border-border-default bg-surface-raised"
      style={{ zIndex: Z_INDEX.sticky }}
    >
      <div className="page-header-inner flex items-center px-4 py-3 gap-3">
        {/* Responsive nav toggle */}
        <IconButton
          id="page-nav-toggle"
          label="Open menu"
          title="Menu"
          intent="neutral"
          appearance="ghost"
          size="sm"
          className="page-menu-toggle"
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
        </IconButton>

        {/* Title */}
        <h1 className="text-lg font-bold tracking-tight leading-none">
          <UnstyledLink
            href="/"
            className="text-content-primary hover:text-intent-accent-content transition-colors"
          >
            Sequence Builder
          </UnstyledLink>
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
                ? "bg-intent-danger-surface hover:bg-intent-danger-surface-hover text-intent-danger-content border-intent-danger-border"
                : "bg-intent-warning-surface hover:bg-intent-warning-surface-hover text-intent-warning-content border-intent-warning-border"
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
            <Button
              intent="neutral"
              appearance="soft"
              size="sm"
              onClick={() => {
                actions.startNew()
                setOpenMenu(null)
              }}
              title="Clear the current sequence and start fresh (Ctrl+Z to undo)"
            >
              New Sequence
            </Button>
          </div>
          <span className="page-menu-sep w-px h-6 bg-border-default mx-1" />
          <div className="page-menu-group">
            <UnstyledLink
              href="/jobs"
              className="text-xs text-content-secondary hover:text-content-primary"
            >
              Jobs ↗
            </UnstyledLink>
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
          className="ms-auto flex items-center gap-1"
        >
          <Button
            id="variables-btn"
            intent="neutral"
            appearance="soft"
            size="sm"
            onClick={() => setEditVariablesModalOpen(true)}
            title="Edit sequence variables"
            aria-label="Variables"
            className="lg:hidden"
          >
            Variables
          </Button>
          <span className="w-px h-4 bg-border-default mx-0.5 lg:hidden" />
          <IconButton
            id="undo-btn"
            label="Undo"
            intent="neutral"
            appearance="soft"
            size="sm"
            onClick={() => void actions.undo()}
            title="Undo (Ctrl+Z)"
            isDisabled={!isUndoPossible}
          >
            ↶
          </IconButton>
          <IconButton
            id="redo-btn"
            label="Redo"
            intent="neutral"
            appearance="soft"
            size="sm"
            onClick={() => void actions.redo()}
            title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
            isDisabled={!isRedoPossible}
          >
            ↷
          </IconButton>
          <span className="w-px h-4 bg-border-default mx-0.5" />
          <IconButton
            label="Collapse all"
            intent="neutral"
            appearance="soft"
            size="sm"
            onClick={() => actions.setAllCollapsed(true)}
            title="Collapse every step + group"
          >
            {collapseAllIcon}
          </IconButton>
          <IconButton
            label="Expand all"
            intent="neutral"
            appearance="soft"
            size="sm"
            onClick={() => actions.setAllCollapsed(false)}
            title="Expand every step + group"
          >
            {expandAllIcon}
          </IconButton>
          <span className="w-px h-6 bg-border-default mx-1" />
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
            <Button
              intent="neutral"
              appearance="soft"
              size="sm"
              onClick={() => {
                setEditVariablesModalOpen(true)
                setOpenMenu(null)
              }}
              title="Edit sequence variables"
            >
              Variables
            </Button>
            <div className="page-menu-row">
              <IconButton
                label="Undo"
                intent="neutral"
                appearance="soft"
                size="sm"
                onClick={() => void actions.undo()}
                title="Undo (Ctrl+Z)"
                isDisabled={!isUndoPossible}
              >
                ↶
              </IconButton>
              <IconButton
                label="Redo"
                intent="neutral"
                appearance="soft"
                size="sm"
                onClick={() => void actions.redo()}
                title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
                isDisabled={!isRedoPossible}
              >
                ↷
              </IconButton>
            </div>
            <div className="page-menu-row">
              <IconButton
                label="Collapse all"
                intent="neutral"
                appearance="soft"
                size="sm"
                onClick={() =>
                  actions.setAllCollapsed(true)
                }
                title="Collapse every step + group"
              >
                {collapseAllIcon}
              </IconButton>
              <IconButton
                label="Expand all"
                intent="neutral"
                appearance="soft"
                size="sm"
                onClick={() =>
                  actions.setAllCollapsed(false)
                }
                title="Expand every step + group"
              >
                {expandAllIcon}
              </IconButton>
            </div>
          </div>

          <span className="page-menu-sep page-menu-mobile-mirror w-px h-6 bg-border-default mx-1" />

          {/* Dry run + run actions */}
          <div className="page-menu-group">
            {/* @charcuterie/ui Switch is uncontrolled (isChecked seeds it,
                then it owns its state) — the `key` re-seeds it whenever the
                atom changes elsewhere (e.g. the DRY RUN badge toggles it),
                keeping the visual in step with the controlled atom. */}
            <div
              id="dry-run-btn"
              title="Toggle dry-run mode — simulate commands without touching files"
            >
              <Switch
                key={`dry-run-${isDryRun}`}
                label="Dry Run"
                isChecked={isDryRun}
                onChange={setIsDryRun}
              />
            </div>

            {isDryRun && (
              <div
                id="failure-mode-btn"
                title="Simulate failures — all commands will fail (dry-run only)"
              >
                <Switch
                  key={`failure-${isFailureMode}`}
                  label="Simulate Failures"
                  isChecked={isFailureMode}
                  onChange={setIsFailureMode}
                />
              </div>
            )}

            <Button
              id="run-btn"
              intent="success"
              appearance="solid"
              size="sm"
              onClick={() => void actions.runSequence()}
              isDisabled={isRunning}
              title="Run each step in order from your browser (client-side). Parallel groups run serially; steps that chain a prior step's named output need Run on Server."
            >
              ▶ Run Sequence
            </Button>
            <Button
              id="run-api-btn"
              intent="info"
              appearance="solid"
              size="sm"
              onClick={() => void actions.runViaApi()}
              isDisabled={isRunning}
              title="Run the whole sequence on the server as one umbrella job (POST /sequences/run). Honors parallel groups and named-output chaining between steps."
            >
              ▶ Run on Server
            </Button>
          </div>

          <span className="page-menu-sep w-px h-6 bg-border-default mx-1" />

          <div className="page-menu-group">
            <div className="page-menu-row">
              {/* Load YAML */}
              <IconButton
                id="load-btn"
                label="Load YAML"
                intent={
                  isYamlPasted ? "success" : "neutral"
                }
                appearance={isYamlPasted ? "soft" : "ghost"}
                size="sm"
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
              </IconButton>
              {/* Copy YAML */}
              <IconButton
                id="copy-btn"
                label="Copy YAML"
                intent={
                  isYamlCopied ? "success" : "neutral"
                }
                appearance={isYamlCopied ? "soft" : "ghost"}
                size="sm"
                onClick={async () => {
                  await actions.copyYaml()
                  setIsYamlCopied(true)
                  setTimeout(
                    () => setIsYamlCopied(false),
                    1500,
                  )
                }}
                title="Copy YAML"
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
              </IconButton>
              {/* View YAML */}
              <IconButton
                label="View YAML"
                intent="neutral"
                appearance="ghost"
                size="sm"
                onClick={() => {
                  // Close the ⋮ menu as the modal opens (like the New
                  // Sequence / Variables items do). The charcuterie Dialog
                  // consumes Escape via floating-ui, so unlike the old
                  // Modal it no longer bubbles to PageHeader's Escape→close
                  // listener — the item has to dismiss the menu itself.
                  setOpenMenu(null)
                  setYamlModalOpen(true)
                }}
                title="View YAML"
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
              </IconButton>
            </div>
          </div>

          <span className="page-menu-sep w-px h-6 bg-border-default mx-1" />

          {/* Colour scheme — cycles light → dark → system (default system,
              follows the OS). Presented as a plain slate menu row so it
              blends with the other ⋮ items instead of the accent-violet
              IconButton it used to be in the toolbar. Same useColorScheme
              wiring + shared `charcuterie-scheme` storage key + first-paint
              script; this is placement/theming only. */}
          <div className="page-menu-group">
            <SchemeMenuButton />
          </div>
        </div>

        {/* Responsive controls toggle */}
        <IconButton
          id="page-controls-toggle"
          label="Sequence actions"
          intent="neutral"
          appearance="ghost"
          size="sm"
          onClick={() =>
            setOpenMenu((prev) =>
              toggleMenu(prev, "controls"),
            )
          }
          title="Sequence actions"
          className="page-menu-toggle text-base leading-none"
        >
          ⋮
        </IconButton>
      </div>
    </div>
  )
}
