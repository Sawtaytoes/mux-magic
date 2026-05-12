import { useAtom } from "jotai"
import { useEffect, useRef } from "react"
import { apiBase } from "../../apiBase"
import { promptModalAtom } from "../../components/PromptModal/promptModalAtom"
import type { PromptOption } from "../../components/PromptModal/types"

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

const sortOptions = (
  options: PromptOption[],
): PromptOption[] =>
  [...options].sort((optionA, optionB) => {
    const isSkipA = optionA.index < 0
    const isSkipB = optionB.index < 0
    if (isSkipA && isSkipB) return 0
    if (isSkipA) return 1
    if (isSkipB) return -1
    const rankA = optionA.index === 0 ? 9.5 : optionA.index
    const rankB = optionB.index === 0 ? 9.5 : optionB.index
    return rankA - rankB
  })

export const PromptModal = () => {
  const [promptData, setPromptData] =
    useAtom(promptModalAtom)
  const promptDataRef = useRef(promptData)
  promptDataRef.current = promptData

  const close = () => setPromptData(null)

  const pick = async (selectedIndex: number) => {
    if (!promptData) return
    close()
    await submitPromptChoice(
      promptData.jobId,
      promptData.promptId,
      selectedIndex,
    )
  }

  // Keyboard shortcuts: digits select options; Space/Escape skip or cancel.
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
      if (event.key === "Escape" || event.key === "-") {
        const cancelOption = current.options.find(
          (option) => option.index === -2,
        )
        if (cancelOption) {
          event.preventDefault()
          void submitPromptChoice(
            current.jobId,
            current.promptId,
            -2,
          )
          setPromptData(null)
          return
        }
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
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () =>
      document.removeEventListener("keydown", handleKeyDown)
  }, [setPromptData])

  if (!promptData) return null

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
        if (event.target === event.currentTarget) close()
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") close()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-message"
        className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg mx-4 p-5 flex flex-col gap-4"
      >
        <p
          id="prompt-message"
          className="text-slate-100 text-sm leading-relaxed"
        >
          {promptData.message}
        </p>

        {promptData.filePath && (
          <div id="prompt-preview" className="flex gap-2">
            <button
              type="button"
              className="text-[10px] bg-emerald-700 hover:bg-emerald-600 text-white px-2 py-0.5 rounded font-medium leading-none"
              onClick={() => {
                if (
                  typeof window.openVideoModal ===
                  "function"
                ) {
                  window.openVideoModal(
                    promptData.filePath ?? "",
                  )
                }
              }}
            >
              ▶ Play
            </button>
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
                    className="shrink-0 text-xs px-3 rounded-r-lg bg-emerald-700 hover:bg-emerald-600 text-white font-medium"
                    title="Preview this file before picking"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      if (
                        typeof window.openVideoModal ===
                        "function"
                      ) {
                        window.openVideoModal(rowFilePath)
                      }
                    }}
                  >
                    ▶ Play
                  </button>
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
      </div>
    </div>
  )
}
