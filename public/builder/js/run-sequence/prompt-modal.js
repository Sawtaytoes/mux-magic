import { esc } from '../util/html-escape.js'

async function submitPromptChoice(jobId, promptId, selectedIndex) {
  closePromptModal()
  try {
    await fetch(`/jobs/${jobId}/input`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promptId, selectedIndex }),
    })
  } catch (err) {
    console.error('Failed to submit prompt response', err)
  }
}

export function closePromptModal() {
  document.getElementById('prompt-modal').classList.add('hidden')
  if (document._promptKeyHandler) {
    document.removeEventListener('keydown', document._promptKeyHandler)
    document._promptKeyHandler = null
  }
}

export function showPromptModal(jobId, promptData) {
  document.getElementById('prompt-message').textContent = promptData.message
  const previewEl = document.getElementById('prompt-preview')
  previewEl.innerHTML = ''
  if (promptData.filePath) {
    const playBtn = document.createElement('button')
    playBtn.className = 'text-[10px] bg-emerald-700 hover:bg-emerald-600 text-white px-2 py-0.5 rounded font-medium leading-none'
    playBtn.textContent = '▶ Play'
    playBtn.onclick = () => {
      if (typeof window.openVideoModal === 'function') window.openVideoModal(promptData.filePath)
    }
    previewEl.appendChild(playBtn)
    previewEl.classList.remove('hidden')
  } else {
    previewEl.classList.add('hidden')
  }
  // Phase B / W10-N2: per-option file paths drive a per-row ▶ Play
  // button on the duplicate-pick modal. Build a lookup so the rendering
  // loop below can decide row-by-row whether to attach a button.
  const filePathsByIndex = new Map()
  if (Array.isArray(promptData.filePaths)) {
    promptData.filePaths.forEach((entry) => {
      if (entry && typeof entry.index === 'number' && typeof entry.path === 'string') {
        filePathsByIndex.set(entry.index, entry.path)
      }
    })
  }
  const optionsEl = document.getElementById('prompt-options')
  optionsEl.innerHTML = ''
  const sortedOptions = [...promptData.options].sort((a, b) => {
    const isSkipA = a.index < 0
    const isSkipB = b.index < 0
    if (isSkipA && isSkipB) return 0
    if (isSkipA) return 1
    if (isSkipB) return -1
    const rankA = a.index === 0 ? 9.5 : a.index
    const rankB = b.index === 0 ? 9.5 : b.index
    return rankA - rankB
  })
  sortedOptions.forEach((option) => {
    const isSkip = option.index === -1
    const rowFilePath = filePathsByIndex.get(option.index) ?? null
    if (rowFilePath) {
      // Multi-file row: option button on the left, ▶ Play on the right.
      // Wrapper div keeps both controls in one row without nesting a
      // button-inside-a-button.
      const rowElement = document.createElement('div')
      rowElement.className = (
        'flex items-stretch gap-2 rounded-lg border border-slate-600'
        + ' hover:border-blue-500 transition-colors'
      )
      const pickButton = document.createElement('button')
      pickButton.className = (
        'flex-1 text-left text-sm px-4 py-2.5 rounded-l-lg'
        + ' text-slate-200 hover:bg-blue-700'
      )
      const keyHintMulti = option.index >= 0 && option.index <= 9
        ? `<span class="text-xs font-mono bg-slate-700 px-1.5 py-0.5 rounded mr-2">${option.index}</span>`
        : ''
      pickButton.innerHTML = `${keyHintMulti}${esc(option.label)}`
      pickButton.onclick = () => {
        submitPromptChoice(jobId, promptData.promptId, option.index)
      }
      const playButton = document.createElement('button')
      playButton.className = (
        'shrink-0 text-xs px-3 rounded-r-lg bg-emerald-700 hover:bg-emerald-600 text-white font-medium'
      )
      playButton.textContent = '▶ Play'
      playButton.title = 'Preview this file before picking'
      playButton.onclick = (event) => {
        event.preventDefault()
        event.stopPropagation()
        if (typeof window.openVideoModal === 'function') {
          window.openVideoModal(rowFilePath)
        }
      }
      rowElement.appendChild(pickButton)
      rowElement.appendChild(playButton)
      optionsEl.appendChild(rowElement)
      return
    }
    const btn = document.createElement('button')
    btn.className = `text-left text-sm px-4 py-2.5 rounded-lg border transition-colors ${
      isSkip
        ? 'border-slate-600 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
        : 'border-slate-600 text-slate-200 hover:bg-blue-700 hover:border-blue-500'
    }`
    const keyHint = option.index >= 0 && option.index <= 9
      ? `<span class="text-xs font-mono bg-slate-700 px-1.5 py-0.5 rounded mr-2">${option.index}</span>`
      : ''
    btn.innerHTML = `${keyHint}${esc(option.label)}`
    btn.onclick = () => submitPromptChoice(jobId, promptData.promptId, option.index)
    optionsEl.appendChild(btn)
  })
  document.getElementById('prompt-modal').classList.remove('hidden')
  document._promptKeyHandler = e => {
    const num = parseInt(e.key, 10)
    if (!isNaN(num)) {
      const match = promptData.options.find(o => o.index === num)
      if (match) submitPromptChoice(jobId, promptData.promptId, match.index)
      return
    }
    if (e.key === ' ' || e.key === 'Spacebar') {
      const skipOpt = promptData.options.find(o => o.index === -1)
      if (skipOpt) { e.preventDefault(); submitPromptChoice(jobId, promptData.promptId, -1) }
      return
    }
    if (e.key === 'Escape' || e.key === '-') {
      const cancelOpt = promptData.options.find(o => o.index === -2)
      if (cancelOpt) { e.preventDefault(); submitPromptChoice(jobId, promptData.promptId, -2); return }
      const skipOpt = promptData.options.find(o => o.index === -1)
      if (skipOpt) { e.preventDefault(); submitPromptChoice(jobId, promptData.promptId, -1) }
    }
  }
  document.addEventListener('keydown', document._promptKeyHandler)
}
