import { getPaths, getSteps } from "../state.js"

// Helpers still living in the inline <script> in index.html during the
// migration. buildParams reaches into per-step links/defaults, which is
// step-card territory — when step-card is extracted in a later stage,
// this dependency moves with it and the bridge entry goes away.
const bridge = () => window.mediaTools

// ─── YAML serialization ──────────────────────────────────────────────────────

// Convert a single in-memory step object into its YAML-shape dict.
// Keys are emitted in a deterministic order (id → alias → command →
// params → isCollapsed) so saved YAML is stable to diff.
export function stepToYaml(step) {
  return {
    id: step.id,
    ...(step.alias ? { alias: step.alias } : {}),
    command: step.command,
    params: bridge().buildParams(step),
    ...(step.isCollapsed ? { isCollapsed: true } : {}),
  }
}

// Group → YAML. Only emit isParallel / isCollapsed / label when they
// carry information so default groups stay uncluttered.
export function groupToYaml(group) {
  const innerFilled = group.steps.filter(
    (step) => step.command !== null,
  )
  return {
    kind: "group",
    ...(group.id ? { id: group.id } : {}),
    ...(group.label ? { label: group.label } : {}),
    ...(group.isParallel ? { isParallel: true } : {}),
    ...(group.isCollapsed ? { isCollapsed: true } : {}),
    steps: innerFilled.map(stepToYaml),
  }
}

export const isGroup = (item) =>
  !!(
    item &&
    typeof item === "object" &&
    item.kind === "group"
  )

// A top-level item contributes content if it's a step with a command,
// or a group containing at least one filled inner step. Empty entries
// (placeholders the user hasn't filled in yet) get dropped on save so
// the YAML doesn't carry junk.
export function topLevelHasContent(item) {
  if (isGroup(item)) {
    return item.steps.some((step) => step.command !== null)
  }
  return item.command !== null
}

export function toYamlStr() {
  const items = getSteps().filter(topLevelHasContent)
  const hasContent =
    items.length || getPaths().some((path) => path.value)
  if (!hasContent) {
    return "# No steps yet"
  }
  const pathsObj = Object.fromEntries(
    getPaths().map((pathVar) => [
      pathVar.id,
      { label: pathVar.label, value: pathVar.value },
    ]),
  )
  const data = {
    paths: pathsObj,
    // Each step ships its stable string ID so { linkedTo: stepN, output: ... }
    // links remain valid across save/load cycles. `alias` is purely cosmetic
    // (builder UI label) — only emitted when the user has set one, so default
    // YAML stays uncluttered. Group entries get the discriminator (`kind`)
    // + their inner steps; bare steps stay in the legacy flat shape.
    steps: items.map((item) =>
      isGroup(item) ? groupToYaml(item) : stepToYaml(item),
    ),
  }
  return window.jsyaml.dump(data, {
    lineWidth: -1,
    flowLevel: 3,
    indent: 2,
  })
}

// ─── Modal lifecycle ─────────────────────────────────────────────────────────

export function updateYaml() {
  const modal = document.getElementById("yaml-modal")
  if (modal && !modal.classList.contains("hidden")) {
    const out = document.getElementById("yaml-out")
    if (out) out.textContent = toYamlStr()
  }
}

export function openYamlModal() {
  document.getElementById("yaml-out").textContent =
    toYamlStr()
  document
    .getElementById("yaml-modal")
    .classList.remove("hidden")
}

// Closes when called programmatically (event omitted) or when the user
// clicks the modal backdrop. Clicks bubbling up from the inner panel
// won't match the backdrop element so the modal stays open.
export function closeYamlModal(event) {
  if (
    !event ||
    event.target === document.getElementById("yaml-modal")
  ) {
    document
      .getElementById("yaml-modal")
      .classList.add("hidden")
  }
}

// ─── Clipboard ───────────────────────────────────────────────────────────────

// Copies the current YAML and flashes both the header icon button (with
// a brief emerald ring) and the modal's "Copy" button (label swap to
// "Copied!"). Either button may be absent depending on which one the
// user clicked from.
export function copyYaml() {
  navigator.clipboard.writeText(toYamlStr()).then(() => {
    const headerButton = document.getElementById("copy-btn")
    if (headerButton) {
      headerButton.classList.add(
        "!text-emerald-400",
        "!border-emerald-500",
      )
      setTimeout(() => {
        headerButton.classList.remove(
          "!text-emerald-400",
          "!border-emerald-500",
        )
      }, 2000)
    }
    const modalButton = document.getElementById(
      "modal-copy-btn",
    )
    if (modalButton) {
      const original = modalButton.textContent
      modalButton.textContent = "Copied!"
      setTimeout(() => {
        modalButton.textContent = original
      }, 2000)
    }
  })
}
