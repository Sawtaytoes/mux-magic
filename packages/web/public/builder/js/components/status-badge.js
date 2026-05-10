import { esc } from "../util/html-escape.js"

/**
 * @param {{ status: string }} props
 * @returns {string}
 */
export function renderStatusBadge({ status }) {
  const map = {
    pending: "bg-blue-950 text-blue-300",
    running: "bg-blue-950 text-blue-400 animate-pulse",
    completed: "bg-emerald-950 text-emerald-400",
    failed: "bg-red-950 text-red-400",
    cancelled: "bg-slate-700 text-slate-300",
  }
  return `<span class="status-badge shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${map[status] ?? ""}">${esc(status)}</span>`
}
