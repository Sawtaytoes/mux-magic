import { Skeleton, VisuallyHidden } from "@charcuterie/ui"

/**
 * What a route shows while its chunk is in flight.
 *
 * Every page is `lazy()` now, so there is a real gap between the
 * click and the render — and before this the gap was blank. A blank
 * page and a slow page are indistinguishable to the person waiting,
 * which is exactly the complaint that started this work.
 *
 * **The announcement is here, not in `Skeleton`.** `@charcuterie/ui`
 * marks skeletons `aria-hidden` on purpose — they stand in for
 * content that does not exist, and announcing them reads three empty
 * bars to a screen reader. So the region that owns the load has to
 * say so: `role="status"` + `aria-busy` + a visually-hidden label,
 * with the bars as decoration underneath.
 *
 * Shaped like a page rather than a spinner (a heading, a couple of
 * controls, a list) so the skeleton occupies roughly the space the
 * real content will, and the layout does not jump when it lands.
 */
export const RouteFallback = () => (
  <main
    aria-busy="true"
    aria-live="polite"
    className="max-w-3xl mx-auto px-4 py-6 space-y-4"
    role="status"
  >
    <VisuallyHidden>Loading page…</VisuallyHidden>

    <Skeleton blockSize="2rem" inlineSize="12rem" />

    <div className="flex items-center gap-3">
      <Skeleton blockSize="2.25rem" inlineSize="10rem" />
      <Skeleton blockSize="2.25rem" inlineSize="10rem" />
    </div>

    <Skeleton lineCount={4} shape="text" />
  </main>
)
