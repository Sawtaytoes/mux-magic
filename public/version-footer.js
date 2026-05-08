// Tiny build-identity footer mounted bottom-right on every page that
// includes this script. Fetches /version on load (the route degrades to
// `gitSha: "dev"` when the prebuild hook didn't run, so this never
// throws in dev). Format mirrors the boot-banner one-liner so the same
// string appears in three places: footer, console, and `curl /version`.
(function () {
  "use strict"

  const formatBuildTime = (iso) => {
    if (!iso) return "dev"

    // Render YYYY-MM-DD HH:MM UTC — short enough for a footer, still
    // unambiguous.
    try {
      const d = new Date(iso)
      const pad = (n) => String(n).padStart(2, "0")
      return (
        d.getUTCFullYear()
        + "-" + pad(d.getUTCMonth() + 1)
        + "-" + pad(d.getUTCDate())
        + " " + pad(d.getUTCHours())
        + ":" + pad(d.getUTCMinutes())
        + " UTC"
      )
    }
    catch {
      return iso
    }
  }

  const ensureFooter = () => {
    const existing = document.getElementById("build-version-footer")
    if (existing) return existing

    const el = document.createElement("div")
    el.id = "build-version-footer"
    el.setAttribute("aria-label", "Build identity")
    el.style.cssText = [
      "position:fixed",
      "right:8px",
      "bottom:6px",
      "z-index:50",
      "font:11px/1.2 system-ui,sans-serif",
      "color:#64748b",
      "background:rgba(15,23,42,0.6)",
      "padding:2px 6px",
      "border-radius:4px",
      "pointer-events:none",
      "user-select:none",
    ].join(";")
    el.textContent = "loading…"

    const mount = () => document.body && document.body.appendChild(el)

    if (document.body) mount()
    else document.addEventListener("DOMContentLoaded", mount)

    return el
  }

  const render = (data) => {
    const el = ensureFooter()
    el.textContent = (
      "git: " + (data.gitShaShort || data.gitSha || "unknown")
      + " · built " + formatBuildTime(data.buildTime)
      + " · node " + (data.nodeVersion || "unknown")
    )
  }

  const renderError = () => {
    const el = ensureFooter()
    el.textContent = "build: unknown"
  }

  fetch("/version", { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error("HTTP " + response.status)
      return response.json()
    })
    .then(render)
    .catch(renderError)
})()
