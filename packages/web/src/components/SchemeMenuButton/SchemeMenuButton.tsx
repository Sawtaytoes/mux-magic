import type { ColorSchemeMode } from "@charcuterie/logic"
import {
  nextColorSchemeMode,
  useColorScheme,
} from "@charcuterie/logic"
import {
  dataSchemeApplier,
  localStoragePersistence,
  matchMediaResolver,
} from "@charcuterie/logic/browser"
import type { ReactNode } from "react"
import { useState } from "react"
import { MonitorIcon } from "../../icons/MonitorIcon/MonitorIcon"
import { MoonIcon } from "../../icons/MoonIcon/MoonIcon"
import { SunIcon } from "../../icons/SunIcon/SunIcon"

// One glyph per mode. mux-magic hand-rolls its SVG icons (no icon library),
// and each inherits `currentColor`, so inside the slate `⋮` popover the row
// takes the menu's foreground colour rather than the accent violet the
// standalone `<ColorSchemeSwitcher>` IconButton rendered in.
const MODE_ICON: Record<ColorSchemeMode, ReactNode> = {
  dark: <MoonIcon />,
  light: <SunIcon />,
  system: <MonitorIcon />,
}

const MODE_LABEL: Record<ColorSchemeMode, string> = {
  dark: "Dark",
  light: "Light",
  system: "System",
}

/**
 * The colour-scheme control as a row inside the header `⋮` overflow menu.
 *
 * It is deliberately NOT the Charcuterie `<ColorSchemeSwitcher>` (an
 * accent-coloured `IconButton`): the owner wanted the control to blend
 * with the muted-slate menu items beside it, so this wires the same
 * `useColorScheme` hook — same default `system`, same light → dark →
 * system cycle order, same `matchMedia` + `localStorage` (shared
 * `charcuterie-scheme` key) + `data-scheme` on `<html>` — to a plain
 * menu-row button styled like its siblings ("Dry Run", "New Sequence").
 * The first-paint script in `index.html` still owns the pre-paint
 * attribute; this only drives runtime switching, exactly as before.
 *
 * The seams are built once (lazy `useState`) so the `matchMedia` query
 * and the core survive re-renders and StrictMode's double mount.
 */
export const SchemeMenuButton = () => {
  const [seams] = useState(() => ({
    apply: dataSchemeApplier(),
    persistence: localStoragePersistence(),
    resolver: matchMediaResolver(),
  }))

  const { cycle, mode } = useColorScheme(seams)

  const nextMode = nextColorSchemeMode(mode)

  return (
    <button
      type="button"
      id="scheme-menu-btn"
      onClick={() => cycle()}
      title={`Colour scheme: ${MODE_LABEL[mode]} — click to switch to ${MODE_LABEL[nextMode]}`}
      aria-label={`Colour scheme: ${MODE_LABEL[mode]}. Activate to switch to ${MODE_LABEL[nextMode]}.`}
      className="flex items-center justify-center gap-2 text-xs text-slate-300 hover:text-white cursor-pointer select-none"
    >
      <span aria-hidden="true" className="contents">
        {MODE_ICON[mode]}
      </span>
      <span className="leading-none">
        Theme: {MODE_LABEL[mode]}
      </span>
    </button>
  )
}
