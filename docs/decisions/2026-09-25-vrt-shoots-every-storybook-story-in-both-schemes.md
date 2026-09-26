# 2026-09-25 — VRT shoots every Storybook story in both schemes

- **Status:** Accepted
- **Date:** 2026-09-25
- **Type:** infra
- **Supersedes:** —
- **Superseded by:** —
- **Source:** fleet rule that every owned Charcuterie app runs VRT (agentic
  `docs/decisions/2026-09-25-every-owned-charcuterie-app-runs-vrt.md`); PR `ci/vrt`.

## Decision

The `vrt` CI job screenshots **every story in the built Storybook, once in `dark` and
once in `light`**, through Charcuterie's shared workflow
(`shared-vrt.yml@workflows-v1`), and reg-suit compares the shots against the baseline in
this repo's own bucket (report at `https://mux-magic.reg-suit.octen.dev`). Storybook is
the only source. There is no test-driven capture.

Five story ids are excluded in `ci.yml`, each with its reason beside it. Four render
`null` by design. `fields-pathfield--default` prints a `Math.random()` path-variable id.

Three Storybook changes make the build worth shooting:

- **A built Storybook answers the mock API in the page.** The route table moved out of
  `mock-server-plugin.ts` into `.storybook/mockRoutes.ts`. The dev-server middleware and
  a `fetch` shim (`staticMockFetch.ts`, installed only when `import.meta.env.PROD`)
  both read it.
- **A dialog story sets `parameters: { isFullViewport: true }`.** The
  `withFullViewport` decorator then gives the story root the viewport's height, so the
  portalled overlay falls inside the element the capture clips to.
- **A fixture that prints a time uses a fixed clock** (`fixtureNow`), never
  `Date.now()`.

## Context

The fleet rule came from CastKit: a renderer change moved text on a real panel and no
gate saw it. This repo had a Storybook of 461 stories and a CI job that only proved it
built. The shared capture serves `storybook-static` as plain files and screenshots
`#storybook-root`. Three problems showed up on the first local run:

1. The mock API existed only as Vite dev-server middleware. In the built Storybook,
   every `/api` request 404'd, so stories showed their error state. `PathField` said
   *"Unexpected token 'o', "not found" is not valid JSON"* where a directory list
   belonged, and the status chips on the jobs page were empty. The composed Storybook
   site serves the same build and had the same defect.
2. Charcuterie's `Dialog`/`Modal` portal their panel out of the story root. Every modal
   story was shot as its 64 px "Re-open modal" button, with no dialog in it.
3. `JobCard` and `JobsPage` fixtures built `startedAt` from `Date.now()`, and the cards
   print that value, so those shots changed on every run.

## What we rejected — DO NOT revert to this

- **Leaving the mock API dev-only and accepting the error states as "deterministic".**
  They were deterministic, but a baseline full of "not found" errors guards nothing.
- **Emitting static JSON files into `storybook-static` for each route.** That would
  depend on how a particular static host answers a `POST`, and it cannot express
  `listDirectoryEntries`'s branch on the request body.
- **A full-viewport wrapper on every story.** Docs pages would become a screen tall per
  embed, and small components would lose their tight crop. The decorator is opt-in, and
  it is also off in docs mode.
- **Changing the shared capture in Charcuterie to handle portals.** That is a fleet
  change on a moving tag. The opt-in parameter keeps this repo's fix in this repo.
  Charcuterie's own capture still clips to the root. Any other app with portalled
  dialogs has the same gap.

## Why

A gate that compares pictures of error states and empty buttons approves exactly the
regressions it exists to catch. The composed Storybook site gets working mock data
from the same change.

## Evidence

Two back-to-back local captures of the final build: 912 shots (456 stories x 2 schemes),
0 failures. **887 of the 912 PNGs are byte-identical.** The other 25 are all
`GroupCard`, `StepCard`, `BuilderSequenceList` and one or two modal shots. They differ
only on the anti-aliased corners of rounded borders, at 9 to 248 pixels per image, and
by at most **3/255** in any channel. It is a raster-path wobble between runs, not
content. `reg-cli` with the job's own settings (`thresholdRate 0.02`, antialiasing
tolerated) passed **912 of 912** for run 1 against run 2. A run at concurrency 1 wobbled
the same way, so it is not load.

Before the fixes, two runs of the same build had 36 differing shots, 16 of them
`JobCard`/`JobsPage` with timestamps several minutes apart. The per-story 404 probe
logged `/api/jobs/status-counts` on 24 stories and `/api/files/*` and
`/api/queries/*` on others.

Known and deliberately unaddressed:

- `DankMono` is not in git, which is licensing. Every monospace run therefore paints in
  the fallback face, the same way on every run.
- The runner image ships no emoji font, so the emoji icons (📋 📁 🔍) paint blank.
  That is the same in every run and every baseline.
