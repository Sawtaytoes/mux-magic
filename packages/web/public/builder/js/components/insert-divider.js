/**
 * @param {{ index: number }} props
 * @returns {string}
 */
export function renderInsertDivider({ index }) {
  return `<div class="col-span-full flex items-center group -my-0.5">
    <div class="flex-1 h-px bg-slate-700/50 group-hover:bg-slate-600 transition-colors"></div>
    <div class="flex items-center gap-1 mx-1">
      <button onclick="insertAt(${index})" title="Insert a step here"
        class="flex items-center gap-1 px-2.5 py-0.5 text-xs text-slate-600 hover:text-blue-400 rounded-full border border-transparent hover:border-blue-500/40 hover:bg-slate-800 transition-all whitespace-nowrap">
        ➕ Step
      </button>
      <button onclick="insertGroupAt(${index}, false)" title="Insert a sequential group here"
        class="flex items-center gap-1 px-2.5 py-0.5 text-xs text-slate-600 hover:text-blue-400 rounded-full border border-transparent hover:border-blue-500/40 hover:bg-slate-800 transition-all whitespace-nowrap">
        ➕ Group
      </button>
      <button onclick="insertGroupAt(${index}, true)" title="Insert a parallel group here"
        class="flex items-center gap-1 px-2.5 py-0.5 text-xs text-slate-600 hover:text-blue-400 rounded-full border border-transparent hover:border-blue-500/40 hover:bg-slate-800 transition-all whitespace-nowrap">
        ➕ Parallel
      </button>
      <button onclick="pasteCardAt({itemIndex: ${index}}, this)" title="Paste a copied step or group here"
        class="flex items-center gap-1 px-2.5 py-0.5 text-xs text-slate-600 hover:text-emerald-400 rounded-full border border-transparent hover:border-emerald-500/40 hover:bg-slate-800 transition-all whitespace-nowrap">
        📋 Paste
      </button>
    </div>
    <div class="flex-1 h-px bg-slate-700/50 group-hover:bg-slate-600 transition-colors"></div>
  </div>`
}
