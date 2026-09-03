import type { ActionTileItem } from "@charcuterie/ui"
import { ActionTiles } from "@charcuterie/ui"

import { usePageTitle } from "../../hooks/usePageTitle"

// Inline SVG module constants, matching the pattern PageHeader already
// uses for its collapse/expand glyphs — these two are used once each and
// don't warrant standalone icon components.
//
// Neither states a colour any more. `ActionTiles` paints the glyph in
// the tile's own hue, so a `text-intent-*-content` here would fight it
// and win, and the two tiles would go back to being the same two
// colours forever no matter how many are added.

const builderIcon = (
  <svg
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-7 h-7"
  >
    <rect x="3" y="4" width="7" height="6" rx="1.5" />
    <rect x="14" y="14" width="7" height="6" rx="1.5" />
    <path d="M10 7h3.5a2 2 0 0 1 2 2v5" />
  </svg>
)

const jobsIcon = (
  <svg
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-7 h-7"
  >
    <path d="M12 8v4l2.5 2.5" />
    <path d="M3.5 12a8.5 8.5 0 1 0 2.2-5.7" />
    <path d="M3 4v3.5h3.5" />
  </svg>
)

const TOOL_ITEMS: ActionTileItem[] = [
  {
    hint: "Compose a sequence of media commands — remux, rename, merge subtitles — and run it locally or on the server.",
    href: "/builder",
    icon: builderIcon,
    label: "Builder",
    value: "builder",
  },
  {
    hint: "Watch running and finished jobs — live progress, logs, paused steps awaiting input, and failures.",
    href: "/jobs",
    icon: jobsIcon,
    label: "Jobs",
    value: "jobs",
  },
]

export const HomePage = () => {
  usePageTitle("Tools")

  return (
    <main className="max-w-6xl mx-auto px-6 py-20">
      <h1 className="text-5xl font-bold tracking-tight text-content-primary text-center">
        Mux Magic
      </h1>
      <p className="mt-4 text-lg text-content-secondary text-center">
        Pick a tool.
      </p>

      {/* Was a local `ToolCard`, which is now deleted. The card this app
          drew by hand is the shape Charcuterie took `ActionTiles` from —
          along with Gallery Downloader's and points-market's, all three
          of which had grown it independently and coloured it themselves.
          The library owns the paint now
          (`@charcuterie/ui` — decision
          `2026-09-02-an-action-tile-is-coloured-and-the-icon-sits-beside-the-name`).

          Two things come with the swap that the hand-rolled card did not
          have. The hues come from the ten-wide categorical palette rather
          than from two `intent` tokens, so a third tool would arrive with
          its own colour instead of repeating one — and `intent` was
          always the wrong family here, because `success` on the Jobs card
          was never a claim that anything had succeeded.

          And each tile is now a routed link. `ActionTiles` sends a
          same-origin `href` through the `RouterLink` this app already
          injects at its root, so these two of the ten raw `<a href>`
          anchors `AppRouter` complains about stop reloading the
          document. */}
      <ActionTiles
        className="mt-14"
        items={TOOL_ITEMS}
        label="Pick a tool"
        /* 420 and not the 280 this was first written with. The grid
           lays `auto-fill` tracks, so the floor decides how many
           tracks the container gets, not how many items there are: a
           280px floor cut this 1152px container into four, put the
           two tools in the first two, and left the right half of the
           page empty. `auto-fit` would collapse the spare tracks and
           is the wrong fix — it would stretch two tiles across a
           2560px window, which is the shape the fleet's grid rule
           exists to prevent.

           420 admits exactly two tracks here and one below ~860px. A
           third tool would still get its own column rather than
           forcing this number up. */
        minTileInlineSize={420}
        size="lg"
      />
    </main>
  )
}
