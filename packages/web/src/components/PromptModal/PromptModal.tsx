import { useAtom, useSetAtom } from "jotai"
import { useEffect, useRef, useState } from "react"
import { apiBase } from "../../apiBase"
import { promptModalAtom } from "../../components/PromptModal/promptModalAtom"
import type { PromptOption } from "../../components/PromptModal/types"
import { videoPreviewModalAtom } from "../../components/VideoPreviewModal/videoPreviewModalAtom"

// Top-level Play button uses a fixed key in the label map, since
// there's no path-distinct row id to peg it to. The per-row buttons
// key by file path (one per option index, guaranteed unique within
// a prompt). Choosing a literal that can never collide with a real
// path keeps the lookup simple.
const TOP_LEVEL_OPEN_KEY = "__top__"

const submitPromptChoice = async (
  jobId: string,
  promptId: string,
  selectedIndex: number,
) => {
  try {
    await fetch(`${apiBase}/jobs/${jobId}/input`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promptId, selectedIndex }),
    })
  } catch (error) {
    console.error("Failed to submit prompt response", error)
  }
}

const cancelJob = async (jobId: string) => {
  try {
    await fetch(`${apiBase}/jobs/${jobId}`, {
      method: "DELETE",
    })
  } catch (error) {
    console.error("Failed to cancel job", error)
  }
}

const sortOptions = (
  options: PromptOption[],
): PromptOption[] =>
  options.toSorted((optionA, optionB) => {
    const isSkipA = optionA.index < 0
    const isSkipB = optionB.index < 0
    if (isSkipA && isSkipB) return 0
    if (isSkipA) return 1
    if (isSkipB) return -1
    const rankA = optionA.index === 0 ? 9.5 : optionA.index
    const rankB = optionB.index === 0 ? 9.5 : optionB.index
    return rankA - rankB
  })

const hasActiveTextSelection = (): boolean => {
  const selection = window.getSelection()
  return (
    selection !== null && selection.toString().length > 0
  )
}

const kbdChipClass =
  "text-[10px] font-mono bg-slate-700 text-slate-200 px-1.5 py-0.5 rounded"

export const PromptModal = () => {
  const [promptData, setPromptData] =
    useAtom(promptModalAtom)
  const setVideoPreview = useSetAtom(videoPreviewModalAtom)
  const promptDataRef = useRef(promptData)
  promptDataRef.current = promptData
  // Mirror FileVideoPlayer's pattern: probe /version on mount to
  // decide whether host-side "Open in Local Player" is reachable.
  // PromptModal is mounted unconditionally at BuilderPage so this
  // fires once for the page lifetime, not once per prompt.
  // (If this ends up shared with more modals, lift to an atom; for
  // now duplicating with FileVideoPlayer is cheaper than the abstraction.)
  const [isContainerized, setIsContainerized] =
    useState(false)
  // Per-button label so the "Launching…/Launched/Failed" feedback is
  // scoped to the button the user actually clicked, not blasted across
  // every Open-in-Player button in the row list.
  const [openLabels, setOpenLabels] = useState<
    Record<string, string>
  >({})

  useEffect(() => {
    fetch(`${apiBase}/version`, { cache: "no-store" })
      .then((resp) => resp.json())
      .then((data: { isContainerized?: boolean }) => {
        setIsContainerized(data.isContainerized === true)
      })
      .catch(() => {})
  }, [])

  const openInLocalPlayer = async (
    key: string,
    path: string,
  ) => {
    setOpenLabels((prev) => ({
      ...prev,
      [key]: "⏳ Launching…",
    }))
    try {
      const resp = await fetch(
        `${apiBase}/files/open-external`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path }),
        },
      )
      const data = (await resp.json()) as {
        isOk: boolean
        error?: string
      }
      setOpenLabels((prev) => ({
        ...prev,
        [key]: data.isOk ? "✓ Launched" : "✗ Failed",
      }))
    } catch {
      setOpenLabels((prev) => ({
        ...prev,
        [key]: "✗ Failed",
      }))
    }
    setTimeout(() => {
      setOpenLabels((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }, 1500)
  }

  // Two distinct exits:
  //   • `dismiss()` — user closed the modal without answering. Pipeline
  //     stays suspended; promptData stays alive with isMinimized=true
  //     so StepCard can render a clickable "paused" badge to reopen.
  //   • `clear()`   — user picked an option or cancelled the job. The
  //     prompt is genuinely gone; wipe the atom outright.
  const dismiss = () =>
    setPromptData((prev) =>
      prev ? { ...prev, isMinimized: true } : prev,
    )
  const clear = () => setPromptData(null)

  const pick = async (selectedIndex: number) => {
    if (!promptData) return
    clear()
    await submitPromptChoice(
      promptData.jobId,
      promptData.promptId,
      selectedIndex,
    )
  }

  const handleCancelJob = async () => {
    if (!promptData) return
    const { jobId } = promptData
    clear()
    await cancelJob(jobId)
  }

  // Keyboard shortcuts:
  //   digits 0..9 — pick that option if it exists
  //   Space      — pick `-1` Skip if present
  //   Escape     — close the modal WITHOUT submitting/cancelling
  //                (universal UX — don't lose a job to an accidental Esc)
  //   Ctrl/Cmd+C — destructive Cancel job (DELETE /jobs/:id)
  //                guarded by an active-text-selection check so the user
  //                can still copy the prompt message normally
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const current = promptDataRef.current
      if (!current) return

      const num = parseInt(event.key, 10)
      if (!Number.isNaN(num)) {
        const match = current.options.find(
          (option) => option.index === num,
        )
        if (match) {
          void submitPromptChoice(
            current.jobId,
            current.promptId,
            match.index,
          )
          setPromptData(null)
        }
        return
      }

      if (event.key === " " || event.key === "Spacebar") {
        const skipOption = current.options.find(
          (option) => option.index === -1,
        )
        if (skipOption) {
          event.preventDefault()
          void submitPromptChoice(
            current.jobId,
            current.promptId,
            -1,
          )
          setPromptData(null)
        }
        return
      }

      if (event.key === "Escape") {
        event.preventDefault()
        // Minimize, don't clear — Escape is a dismissal, the job is
        // still waiting for input. StepCard reopens via its paused
        // badge once the user knows where to look.
        setPromptData((prev) =>
          prev ? { ...prev, isMinimized: true } : prev,
        )
        return
      }

      const isCancelChord =
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "c"
      if (isCancelChord && !hasActiveTextSelection()) {
        event.preventDefault()
        const { jobId } = current
        setPromptData(null)
        void cancelJob(jobId)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () =>
      document.removeEventListener("keydown", handleKeyDown)
  }, [setPromptData])

  if (!promptData || promptData.isMinimized) return null

  const sortedOptions = sortOptions(promptData.options)
  const filePathsByIndex = new Map(
    (promptData.filePaths ?? []).map((entry) => [
      entry.index,
      entry.path,
    ]),
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      role="none"
      onClick={(event) => {
        if (event.target === event.currentTarget) dismiss()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-message"
        className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg mx-4 p-5 flex flex-col gap-4"
      >
        <p
          id="prompt-paused-banner"
          className="text-xs text-amber-300 bg-amber-900/30 border border-amber-700/50 rounded px-2 py-1.5"
        >
          ⏸ The pipeline is paused waiting for your choice.
        </p>

        <div className="flex flex-col gap-1">
          <p
            id="prompt-message"
            className={
              promptData.subtitle
                ? "text-slate-100 text-lg font-semibold leading-snug"
                : "text-slate-100 text-sm leading-relaxed"
            }
          >
            {promptData.message}
          </p>
          {promptData.subtitle && (
            <p
              id="prompt-subtitle"
              className="text-slate-400 text-xs leading-snug break-all"
            >
              {promptData.subtitle}
            </p>
          )}
        </div>

        {promptData.filePath && (
          <div id="prompt-preview" className="flex gap-2">
            <button
              type="button"
              className="text-[10px] bg-emerald-700 hover:bg-emerald-600 text-white px-2 py-0.5 rounded font-medium leading-none"
              onClick={() => {
                setVideoPreview({
                  path: promptData.filePath ?? "",
                })
              }}
            >
              ▶ Play
            </button>
            {!isContainerized && promptData.filePath && (
              <button
                type="button"
                className="text-[10px] bg-slate-700 hover:bg-slate-600 text-slate-200 px-2 py-0.5 rounded font-medium leading-none border border-slate-600"
                title="Open this file in the OS default media player"
                onClick={() =>
                  void openInLocalPlayer(
                    TOP_LEVEL_OPEN_KEY,
                    promptData.filePath ?? "",
                  )
                }
              >
                {openLabels[TOP_LEVEL_OPEN_KEY] ??
                  "⬡ Open in Local Player"}
              </button>
            )}
          </div>
        )}

        <div
          id="prompt-options"
          className="flex flex-col gap-2"
        >
          {sortedOptions.map((option) => {
            const isSkip = option.index === -1
            const rowFilePath =
              filePathsByIndex.get(option.index) ?? null
            const keyHint =
              option.index >= 0 && option.index <= 9 ? (
                <span className="text-xs font-mono bg-slate-700 px-1.5 py-0.5 rounded mr-2">
                  {option.index}
                </span>
              ) : null

            if (rowFilePath) {
              // The right-most button owns rounded-r-lg. When the host
              // can launch an external player we tack a third button on
              // the end and shift the rounding to it; otherwise Play
              // stays right-most.
              const isShowingOpenInLocalPlayer =
                !isContainerized
              return (
                <div
                  key={option.index}
                  className="flex items-stretch gap-2 rounded-lg border border-slate-600 hover:border-blue-500 transition-colors"
                >
                  <button
                    type="button"
                    className="flex-1 text-left text-sm px-4 py-2.5 rounded-l-lg text-slate-200 hover:bg-blue-700"
                    onClick={() => void pick(option.index)}
                  >
                    {keyHint}
                    {option.label}
                  </button>
                  <button
                    type="button"
                    className={`shrink-0 text-xs px-3 bg-emerald-700 hover:bg-emerald-600 text-white font-medium${isShowingOpenInLocalPlayer ? "" : " rounded-r-lg"}`}
                    title="Preview this file before picking"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      setVideoPreview({ path: rowFilePath })
                    }}
                  >
                    ▶ Play
                  </button>
                  {isShowingOpenInLocalPlayer && (
                    <button
                      type="button"
                      className="shrink-0 text-xs px-3 rounded-r-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium border-l border-slate-600"
                      title="Open this file in the OS default media player"
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        void openInLocalPlayer(
                          rowFilePath,
                          rowFilePath,
                        )
                      }}
                    >
                      {openLabels[rowFilePath] ??
                        "⬡ Open in Local Player"}
                    </button>
                  )}
                </div>
              )
            }

            return (
              <button
                type="button"
                key={option.index}
                className={`text-left text-sm px-4 py-2.5 rounded-lg border transition-colors ${
                  isSkip
                    ? "border-slate-600 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                    : "border-slate-600 text-slate-200 hover:bg-blue-700 hover:border-blue-500"
                }`}
                onClick={() => void pick(option.index)}
              >
                {keyHint}
                {option.label}
              </button>
            )
          })}
        </div>

        <div
          id="prompt-keyboard-hints"
          className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400"
        >
          <span className="flex items-center gap-1">
            <kbd className={kbdChipClass}>0-9</kbd>Pick
            option
          </span>
          <span className="flex items-center gap-1">
            <kbd className={kbdChipClass}>Space</kbd>Skip
          </span>
          <span className="flex items-center gap-1">
            <kbd className={kbdChipClass}>Esc</kbd>Close
            (pipeline waits)
          </span>
          <span className="flex items-center gap-1">
            <kbd className={kbdChipClass}>Ctrl+C</kbd>Cancel
            job
          </span>
        </div>

        <div
          id="prompt-action-bar"
          className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-700"
        >
          <button
            type="button"
            id="prompt-cancel-job"
            className="text-xs bg-red-700 hover:bg-red-600 text-white px-3 py-1.5 rounded font-medium"
            title="Cancel the running job (DELETE /jobs/:id)"
            onClick={() => void handleCancelJob()}
          >
            Cancel job
          </button>
          <button
            type="button"
            id="prompt-close"
            className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded font-medium"
            title="Close this modal; the job will keep waiting for input"
            onClick={dismiss}
          >
            Close (job stays running)
          </button>
          <span className="text-[10px] text-slate-400">
            The pipeline will keep waiting for input.
          </span>
        </div>
      </div>
    </div>
  )
}
