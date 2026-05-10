// Shared progress-bar helpers. Loaded as <script src="/progress-utils.js">
// so the /jobs page and the builder's "Run via API" modal share a single
// implementation — no module bundling needed.
//
// Three functions, page-state-agnostic by design:
//   - mergeProgress(snapshot, event): pure merge of incoming
//     ProgressEvent fields onto a snapshot. Top-level rollup fields
//     (ratio/filesDone/filesTotal) merge field-by-field since the server
//     doesn't always include them; currentFiles is whole-array replace
//     because the server already aggregates across all active trackers
//     (absence = no active files, so the stack collapses to empty).
//   - paintProgressBar(container, snapshot): updates a mounted bar in
//     place. Container must hold .progress-bar > .progress-fill, a
//     .progress-label, and a .progress-files stack — exactly the markup
//     createProgressRow produces.
//   - createProgressRow(): returns a detached .progress-row element the
//     caller appends wherever it wants. Page owns when to mount /
//     unmount; this helper just builds the DOM nodes.
;((global) => {
  function mergeProgress(snapshot, event) {
    var merged = Object.assign({}, snapshot || {})
    if (event.ratio !== undefined)
      merged.ratio = event.ratio
    if (event.filesDone !== undefined)
      merged.filesDone = event.filesDone
    if (event.filesTotal !== undefined)
      merged.filesTotal = event.filesTotal
    // currentFiles is authoritative when present; absence means "no
    // active files" and we clear the previous list. Server omits the
    // field entirely when activeFiles is empty.
    merged.currentFiles = Array.isArray(event.currentFiles)
      ? event.currentFiles
      : []
    return merged
  }

  function paintTopBar(bar, fill, label, snap) {
    var ratio =
      typeof snap.ratio === "number" ? snap.ratio : null
    if (ratio === null) {
      bar.classList.add("indeterminate")
      fill.style.width = ""
    } else {
      bar.classList.remove("indeterminate")
      var pct = Math.max(0, Math.min(1, ratio)) * 100
      fill.style.width = `${pct.toFixed(1)}%`
    }
    var parts = []
    if (
      typeof snap.filesDone === "number" &&
      typeof snap.filesTotal === "number"
    ) {
      parts.push(
        `${snap.filesDone}/${snap.filesTotal} files`,
      )
    }
    if (ratio !== null) {
      parts.push(`${(ratio * 100).toFixed(0)}%`)
    }
    // Speed + ETA — only when BandwidthFormat is loaded and the snapshot
    // carries server-side transfer fields (bytesPerSecond / bytesRemaining).
    if (typeof global.BandwidthFormat !== "undefined") {
      var fmt = global.BandwidthFormat
      var bw = fmt.formatBandwidth(snap.bytesPerSecond)
      if (bw) parts.push(bw)
      var eta = fmt.formatEta(
        snap.bytesRemaining,
        snap.bytesPerSecond,
      )
      if (eta) parts.push(eta)
    }
    label.textContent = parts.join(" · ")
  }

  function buildFileRow(entry) {
    var row = document.createElement("div")
    row.className = "progress-file-row"
    var name = document.createElement("div")
    name.className = "progress-file-name"
    name.textContent =
      String(entry.path).split(/[\\/]/).pop() || entry.path
    name.title = entry.path
    var ratioCell = document.createElement("div")
    ratioCell.className = "progress-file-ratio"
    var fileBar = document.createElement("div")
    fileBar.className = "progress-file-bar"
    var fileFill = document.createElement("div")
    fileFill.className = "progress-file-fill"
    fileBar.append(fileFill)
    if (typeof entry.ratio === "number") {
      ratioCell.textContent = `${(entry.ratio * 100).toFixed(0)}%`
      fileBar.classList.remove("indeterminate")
      fileFill.style.width = `${(Math.max(0, Math.min(1, entry.ratio)) * 100).toFixed(1)}%`
    } else {
      ratioCell.textContent = ""
      fileBar.classList.add("indeterminate")
    }
    row.append(name, ratioCell, fileBar)
    return row
  }

  function paintProgressBar(container, snapshot) {
    if (!container) return
    var snap = snapshot || {}
    var bar = container.querySelector(".progress-bar")
    var fill = container.querySelector(".progress-fill")
    var label = container.querySelector(".progress-label")
    if (!bar || !fill || !label) return

    paintTopBar(bar, fill, label, snap)

    // Per-file rows. Each in-flight tracker becomes one row with a thin
    // bar — multiple visible simultaneously when Tasks run in parallel.
    // Empty list → empty container so the spacing collapses.
    var filesContainer = container.querySelector(
      ".progress-files",
    )
    var currentFiles = Array.isArray(snap.currentFiles)
      ? snap.currentFiles
      : []
    if (!filesContainer) return
    if (currentFiles.length === 0) {
      filesContainer.replaceChildren()
      return
    }
    var rows = currentFiles.map(buildFileRow)
    filesContainer.replaceChildren.apply(
      filesContainer,
      rows,
    )
  }

  function createProgressRow() {
    var row = document.createElement("div")
    row.className = "progress-row"
    var bar = document.createElement("div")
    bar.className = "progress-bar"
    var fill = document.createElement("div")
    fill.className = "progress-fill"
    bar.append(fill)
    var label = document.createElement("div")
    label.className = "progress-label"
    var filesContainer = document.createElement("div")
    filesContainer.className = "progress-files"
    row.append(bar, label, filesContainer)
    return row
  }

  global.ProgressUtils = {
    mergeProgress: mergeProgress,
    paintProgressBar: paintProgressBar,
    createProgressRow: createProgressRow,
  }
})(typeof window !== "undefined" ? window : globalThis)
