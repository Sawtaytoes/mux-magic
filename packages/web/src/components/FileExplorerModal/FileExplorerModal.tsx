import type {
  DeleteFilesResponse,
  DeleteModeResponse,
  ListFilesResponse,
} from "@mux-magic/api/api-types"
import { useAtom, useSetAtom } from "jotai"
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import { apiBase } from "../../apiBase"
import { audioPreviewModalAtom } from "../../components/AudioPreviewModal/audioPreviewModalAtom"
import { fileExplorerAtom } from "../../components/FileExplorerModal/fileExplorerAtom"
import type {
  FileEntry,
  SortColumn,
  SortDirection,
} from "../../components/FileExplorerModal/types"
import { imagePreviewModalAtom } from "../../components/ImagePreviewModal/imagePreviewModalAtom"
import { videoPreviewModalAtom } from "../../components/VideoPreviewModal/videoPreviewModalAtom"

// ─── Constants ────────────────────────────────────────────────────────────────

const VIDEO_EXTENSIONS = new Set([
  ".mkv",
  ".mp4",
  ".m4v",
  ".webm",
  ".avi",
  ".mov",
  ".mpg",
  ".mpeg",
  ".ts",
  ".wmv",
])

const AUDIO_EXTENSIONS = new Set([
  ".aac",
  ".aif",
  ".aiff",
  ".flac",
  ".m4a",
  ".m4b",
  ".mp3",
  ".ogg",
  ".opus",
  ".wav",
  ".wave",
])

const IMAGE_EXTENSIONS = new Set([
  ".avif",
  ".bmp",
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".webp",
])

const _BROWSER_UNSUPPORTED_AUDIO = new Set([
  "ac-3",
  "dts",
  "e-ac-3",
  "eac3",
  "mlp",
  "mlp fba",
  "pcm",
  "truehd",
])

// ─── Utilities ────────────────────────────────────────────────────────────────

const extOf = (name: string) => {
  const dot = name.lastIndexOf(".")
  return dot < 0 ? "" : name.slice(dot).toLowerCase()
}

const isVideoFile = (name: string) =>
  VIDEO_EXTENSIONS.has(extOf(name))
const isAudioFile = (name: string) =>
  AUDIO_EXTENSIONS.has(extOf(name))
const isImageFile = (name: string) =>
  IMAGE_EXTENSIONS.has(extOf(name))

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

const formatMtime = (iso: string | null) => {
  if (!iso) return "—"
  const dateObj = new Date(iso)
  const yyyy = dateObj.getFullYear()
  const mm = String(dateObj.getMonth() + 1).padStart(2, "0")
  const dd = String(dateObj.getDate()).padStart(2, "0")
  const hh = String(dateObj.getHours()).padStart(2, "0")
  const mi = String(dateObj.getMinutes()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

const durationToSeconds = (
  timecode: string | null,
): number | null => {
  if (!timecode) return null
  const parts = timecode.split(":").map(Number)
  if (parts.some(Number.isNaN)) return null
  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return parts[0] * 3600 + parts[1] * 60 + parts[2]
}

const joinPath = (
  dir: string,
  child: string,
  separator: string,
) => {
  const trimmed = dir.endsWith(separator)
    ? dir.slice(0, -1)
    : dir
  return `${trimmed}${separator}${child}`
}

const buildBreadcrumb = (
  path: string,
  sep: string,
): Array<{ label: string; target: string }> => {
  if (!path) return []
  const parts = path.split(sep)
  const segments: Array<{ label: string; target: string }> =
    []
  let cumulative = ""
  parts.forEach((part, idx) => {
    if (idx === 0) {
      if (part === "") {
        cumulative = sep
        segments.push({ label: sep, target: sep })
      } else {
        cumulative = part + sep
        segments.push({ label: part, target: cumulative })
      }
      return
    }
    if (part === "") return
    cumulative += (idx === 1 ? "" : sep) + part
    const target = cumulative.replace(
      new RegExp(sep === "\\" ? "\\\\$" : `${sep}$`),
      "",
    )
    segments.push({ label: part, target })
  })
  return segments
}

// ─── Sort ─────────────────────────────────────────────────────────────────────

const buildComparator =
  (column: SortColumn, direction: SortDirection) =>
  (entryA: FileEntry, entryB: FileEntry) => {
    if (entryA.isDirectory !== entryB.isDirectory) {
      return entryA.isDirectory ? -1 : 1
    }
    const dir = direction === "desc" ? -1 : 1
    if (column === "name") {
      return (
        entryA.name.localeCompare(entryB.name, undefined, {
          sensitivity: "base",
        }) * dir
      )
    }
    if (column === "duration") {
      const secA = durationToSeconds(entryA.duration)
      const secB = durationToSeconds(entryB.duration)
      if (secA === null && secB === null) return 0
      if (secA === null) return 1
      if (secB === null) return -1
      return (secA - secB) * dir
    }
    if (column === "size")
      return (entryA.size - entryB.size) * dir
    if (column === "mtime") {
      if (!entryA.mtime && !entryB.mtime) return 0
      if (!entryA.mtime) return 1
      if (!entryB.mtime) return -1
      return (
        (Date.parse(entryA.mtime) -
          Date.parse(entryB.mtime)) *
        dir
      )
    }
    return 0
  }

// ─── FileExplorerModal ────────────────────────────────────────────────────────

export const FileExplorerModal = () => {
  const [explorerState, setExplorerState] = useAtom(
    fileExplorerAtom,
  )

  const [entries, setEntries] = useState<FileEntry[]>([])
  const [currentPath, setCurrentPath] = useState("")
  const [separator, setSeparator] = useState("/")
  const [deleteMode, setDeleteMode] = useState<
    "trash" | "permanent"
  >("trash")
  const [deleteModeReason, setDeleteModeReason] = useState<
    string | null
  >(null)
  const [selected, setSelected] = useState<Set<string>>(
    new Set(),
  )
  const [sortColumn, setSortColumn] =
    useState<SortColumn>("default")
  const [sortDirection, setSortDirection] =
    useState<SortDirection>("asc")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const setVideoPreview = useSetAtom(videoPreviewModalAtom)
  const setAudioPreview = useSetAtom(audioPreviewModalAtom)
  const setImagePreview = useSetAtom(imagePreviewModalAtom)

  // Open/navigate logic: when explorerState changes, reset and load new path.
  useEffect(() => {
    if (!explorerState) return
    setCurrentPath(explorerState.path)
    setSelected(new Set())
    setError(null)
  }, [explorerState])

  const loadDeleteMode = useCallback(
    async (path: string) => {
      try {
        const params = new URLSearchParams()
        if (path) params.set("path", path)
        const resp = await fetch(
          `${apiBase}/files/delete-mode?${params}`,
        )
        const data =
          (await resp.json()) as DeleteModeResponse
        setDeleteMode(data.mode)
        setDeleteModeReason(data.reason ?? null)
      } catch {
        setDeleteMode("permanent")
        setDeleteModeReason(
          "Could not determine delete mode",
        )
      }
    },
    [],
  )

  const loadListing = useCallback(async (path: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        path,
        includeDuration: "1",
      })
      const resp = await fetch(
        `${apiBase}/files/list?${params}`,
      )
      const data = (await resp.json()) as ListFilesResponse
      if (data.error) {
        setError(data.error)
      } else {
        setEntries(data.entries)
        setSeparator(data.separator)
        setSelected(new Set())
      }
    } catch (fetchError) {
      setError(String(fetchError))
    }
    setIsLoading(false)
  }, [])

  // Load data when currentPath is set/changes.
  useEffect(() => {
    if (!currentPath || !explorerState) return
    void Promise.all([
      loadDeleteMode(currentPath),
      loadListing(currentPath),
    ])
  }, [
    currentPath,
    explorerState,
    loadDeleteMode,
    loadListing,
  ])

  const navigateTo = useCallback(
    (newPath: string) => {
      setCurrentPath(newPath)
      setSelected(new Set())
      void loadDeleteMode(newPath)
      void loadListing(newPath)
    },
    [loadDeleteMode, loadListing],
  )

  const sortedEntries = useMemo(
    () =>
      [...entries].sort(
        buildComparator(sortColumn, sortDirection),
      ),
    [entries, sortColumn, sortDirection],
  )

  const toggleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) =>
        prev === "asc" ? "desc" : "asc",
      )
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
  }

  const sortIndicator = (column: SortColumn) => {
    if (sortColumn !== column) return null
    return (
      <span className="ml-1 text-slate-300">
        {sortDirection === "asc" ? "▲" : "▼"}
      </span>
    )
  }

  const toggleSelected = (
    name: string,
    isChecked: boolean,
  ) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (isChecked) next.add(name)
      else next.delete(name)
      return next
    })
  }

  const selectAll = (isChecked: boolean) => {
    if (isChecked) {
      setSelected(
        new Set(entries.map((entry) => entry.name)),
      )
    } else {
      setSelected(new Set())
    }
  }

  const copyPath = async (name: string) => {
    const fullPath = joinPath(currentPath, name, separator)
    try {
      await navigator.clipboard.writeText(fullPath)
    } catch {
      window.prompt("Copy this path manually:", fullPath)
    }
  }

  const confirmDelete = async () => {
    if (selected.size === 0) return
    const verb =
      deleteMode === "trash" ? "Move" : "Permanently delete"
    const target =
      deleteMode === "trash" ? " to Recycle Bin" : ""
    const filesText = `${selected.size} file${selected.size === 1 ? "" : "s"}`
    if (!window.confirm(`${verb} ${filesText}${target}?`))
      return

    const paths = Array.from(selected).map((name) =>
      joinPath(currentPath, name, separator),
    )
    try {
      const resp = await fetch(`${apiBase}/files`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths }),
      })
      const data =
        (await resp.json()) as DeleteFilesResponse
      const failed = data.results.filter(
        (result) => !result.isOk,
      )
      if (failed.length > 0) {
        const summary = failed
          .map(
            (result) => `• ${result.path}: ${result.error}`,
          )
          .join("\n")
        window.alert(
          `Deleted ${data.results.length - failed.length} of ${data.results.length}.\n\nFailed:\n${summary}`,
        )
      }
      setSelected(new Set())
      void loadListing(currentPath)
    } catch (fetchError) {
      window.alert(`Delete request failed: ${fetchError}`)
    }
  }

  const handleConfirmPick = () => {
    const callback = explorerState?.pickerOnSelect
    if (!callback) return
    setExplorerState(null)
    callback(currentPath)
  }

  const close = useCallback(() => {
    setExplorerState(null)
  }, [setExplorerState])

  // ESC: close the explorer when open. Video preview owns its own Escape
  // (see VideoPreviewModal / FileVideoPlayer), and runs at z-[60] so its
  // backdrop sits above this explorer — clicking outside it lets that
  // Escape fire before this one.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      if (!explorerState) return
      event.preventDefault()
      close()
    }
    document.addEventListener("keydown", handleKeyDown, {
      capture: true,
    })
    return () =>
      document.removeEventListener(
        "keydown",
        handleKeyDown,
        { capture: true },
      )
  }, [explorerState, close])

  if (!explorerState) return null

  const isPicker =
    typeof explorerState.pickerOnSelect === "function"
  const breadcrumbSegments = buildBreadcrumb(
    currentPath,
    separator,
  )

  const deleteModeLabel =
    deleteMode === "trash"
      ? "Delete → Recycle Bin"
      : "Delete → Permanent"
  const deleteModeClass =
    deleteMode === "trash"
      ? "text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium text-emerald-300 border border-emerald-700/50 cursor-default select-none"
      : "text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium text-rose-300 border border-rose-700/50 cursor-default select-none"

  return (
    <div
      role="none"
      id="file-explorer-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(event) => {
        if (event.target === event.currentTarget) close()
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") close()
      }}
    >
      <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl mx-4 flex flex-col overflow-hidden max-h-[90dvh]">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700 shrink-0 flex-wrap">
          {/* Breadcrumb */}
          <div
            id="file-explorer-breadcrumb"
            className="flex items-center gap-1 text-xs font-mono flex-1 min-w-0 overflow-hidden"
          >
            {breadcrumbSegments.map((seg, idx) => {
              const isLast =
                idx === breadcrumbSegments.length - 1
              return isLast ? (
                <span
                  key={seg.target}
                  className="text-slate-200 truncate"
                >
                  {seg.label}
                </span>
              ) : (
                <span
                  key={seg.target}
                  className="flex items-center gap-1 shrink-0"
                >
                  <button
                    type="button"
                    className="text-blue-300 hover:text-blue-200 underline-offset-2 hover:underline truncate"
                    title={`Navigate to ${seg.target}`}
                    onClick={() => navigateTo(seg.target)}
                  >
                    {seg.label}
                  </button>
                  {seg.label !== separator && (
                    <span className="text-slate-500">
                      {separator}
                    </span>
                  )}
                </span>
              )
            })}
          </div>

          <span
            id="file-explorer-mode-badge"
            className={deleteModeClass}
            title={
              deleteMode === "permanent"
                ? (deleteModeReason ??
                  "Deletes are permanent — no recovery")
                : "Deletes go to the OS Recycle Bin"
            }
          >
            {deleteModeLabel}
          </span>

          {isPicker && (
            <span
              id="file-explorer-picker-badge"
              className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium bg-blue-900/50 text-blue-300 border border-blue-700/50"
            >
              PICKER
            </span>
          )}

          {isPicker && (
            <button
              type="button"
              id="file-explorer-pick-btn"
              onClick={handleConfirmPick}
              className="text-xs bg-blue-700 hover:bg-blue-600 text-white px-2 py-1 rounded font-medium"
            >
              📌 Use this folder
            </button>
          )}

          <button
            type="button"
            onClick={close}
            className="text-slate-400 hover:text-white text-base leading-none ml-1"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div
          id="file-explorer-body"
          className="flex-1 overflow-y-auto min-h-0"
        >
          {isLoading && (
            <p className="text-slate-500 text-sm py-4 text-center">
              Loading…
            </p>
          )}
          {!isLoading && error && (
            <p className="text-rose-400 text-sm py-4 px-3">
              {error}
            </p>
          )}
          {!isLoading &&
            !error &&
            sortedEntries.length === 0 && (
              <p className="text-slate-500 text-sm py-4 text-center">
                Folder is empty.
              </p>
            )}
          {!isLoading &&
            !error &&
            sortedEntries.length > 0 && (
              <div className="px-3 py-2">
                <table className="w-full text-sm">
                  <thead className="text-[10px] uppercase tracking-wider text-slate-300 sticky top-0 bg-slate-800 z-10 shadow-sm">
                    <tr>
                      <th className="py-2 px-2 text-left w-6">
                        <input
                          type="checkbox"
                          title="Select all files"
                          onChange={(event) =>
                            selectAll(event.target.checked)
                          }
                          checked={
                            selected.size > 0 &&
                            entries.every((entry) =>
                              selected.has(entry.name),
                            )
                          }
                        />
                      </th>
                      {(
                        [
                          {
                            col: "name" as const,
                            label: "Name",
                            align: "text-left",
                          },
                          {
                            col: "duration" as const,
                            label: "Duration",
                            align: "text-right",
                          },
                          {
                            col: "size" as const,
                            label: "Size",
                            align: "text-right",
                          },
                          {
                            col: "mtime" as const,
                            label: "Modified",
                            align: "text-left",
                          },
                        ] as const
                      ).map(({ col, label, align }) => (
                        <th
                          key={col}
                          className={`py-2 px-2 ${align} cursor-pointer hover:text-white select-none`}
                          onClick={() => toggleSort(col)}
                          title={`Sort by ${label.toLowerCase()}`}
                        >
                          {label}
                          {sortIndicator(col)}
                        </th>
                      ))}
                      <th className="py-2 px-2 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedEntries.map((entry) => {
                      const previewKind:
                        | "video"
                        | "audio"
                        | "image"
                        | null =
                        entry.isFile &&
                        isVideoFile(entry.name)
                          ? "video"
                          : entry.isFile &&
                              isAudioFile(entry.name)
                            ? "audio"
                            : entry.isFile &&
                                isImageFile(entry.name)
                              ? "image"
                              : null
                      const icon = entry.isDirectory
                        ? "📁"
                        : previewKind === "video"
                          ? "🎬"
                          : previewKind === "audio"
                            ? "🎵"
                            : previewKind === "image"
                              ? "🖼️"
                              : "📄"
                      const onPreviewClick = () => {
                        const fullPath = joinPath(
                          currentPath,
                          entry.name,
                          separator,
                        )
                        if (previewKind === "video")
                          setVideoPreview({
                            path: fullPath,
                          })
                        else if (previewKind === "audio")
                          setAudioPreview({
                            path: fullPath,
                          })
                        else if (previewKind === "image")
                          setImagePreview({
                            path: fullPath,
                          })
                      }
                      const previewTitle =
                        previewKind === "video"
                          ? "Play in browser"
                          : previewKind === "audio"
                            ? "Play in browser"
                            : previewKind === "image"
                              ? "View image"
                              : ""

                      return (
                        <tr
                          key={entry.name}
                          className="border-b border-slate-800 hover:bg-slate-800/30"
                        >
                          <td className="py-1 px-2">
                            <input
                              type="checkbox"
                              title={
                                entry.isDirectory
                                  ? "Select this folder (deletes recursively)"
                                  : undefined
                              }
                              checked={selected.has(
                                entry.name,
                              )}
                              onChange={(event) =>
                                toggleSelected(
                                  entry.name,
                                  event.target.checked,
                                )
                              }
                            />
                          </td>
                          <td className="py-1 px-2 break-all">
                            {entry.isDirectory ? (
                              <button
                                type="button"
                                className="fe-name fe-dir text-left text-slate-200 hover:text-blue-300 underline-offset-2 hover:underline w-full"
                                title="Open this folder"
                                onClick={() =>
                                  navigateTo(
                                    joinPath(
                                      currentPath,
                                      entry.name,
                                      separator,
                                    ),
                                  )
                                }
                              >
                                {icon} {entry.name}
                              </button>
                            ) : previewKind !== null ? (
                              <button
                                type="button"
                                className="fe-name fe-file text-left text-slate-200 hover:text-blue-300 underline-offset-2 hover:underline w-full"
                                title={previewTitle}
                                onClick={onPreviewClick}
                              >
                                {icon} {entry.name}
                              </button>
                            ) : (
                              <span className="text-slate-400">
                                {icon} {entry.name}
                              </span>
                            )}
                          </td>
                          <td className="py-1 px-2 text-right text-slate-300 font-mono text-xs whitespace-nowrap">
                            {entry.duration ?? "—"}
                          </td>
                          <td className="py-1 px-2 text-right text-slate-400 font-mono text-xs whitespace-nowrap">
                            {entry.isDirectory
                              ? "—"
                              : formatSize(entry.size)}
                          </td>
                          <td className="py-1 px-2 text-slate-400 font-mono text-xs whitespace-nowrap">
                            {formatMtime(entry.mtime)}
                          </td>
                          <td className="py-1 px-2 text-center">
                            {entry.isFile ? (
                              <button
                                type="button"
                                className="fe-copy text-slate-400 hover:text-slate-200"
                                title="Copy absolute path"
                                onClick={() =>
                                  void copyPath(entry.name)
                                }
                              >
                                📋
                              </button>
                            ) : (
                              <span className="text-slate-700">
                                —
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
        </div>

        {/* Footer — always rendered; button stays inert when nothing is
            selected. Picker mode's "📌 Use this folder" lives in the title
            bar, so the two affordances coexist without competing. */}
        <div
          id="file-explorer-footer"
          className="flex items-center gap-3 px-4 py-2 border-t border-slate-700 shrink-0"
        >
          <span
            id="file-explorer-selection-count"
            className="text-xs text-slate-400"
          >
            {selected.size} selected
          </span>
          <button
            type="button"
            id="file-explorer-delete-btn"
            disabled={selected.size === 0}
            onClick={() => void confirmDelete()}
            className="text-xs bg-rose-700 hover:bg-rose-600 disabled:opacity-40 text-white px-3 py-1 rounded font-medium ml-auto"
          >
            Delete selected
          </button>
        </div>
      </div>
    </div>
  )
}
