# Storybook Conventions

Every new component **must** ship with three files in the same directory:

1. **`ComponentName.stories.tsx`** — one named export per distinct visual state (`Indeterminate`, `Determinate`, `WithPerFileRows`, `Complete`, etc.). Stories must show the component isolated from page-level concerns; use a Jotai `Provider` + `createStore` to inject atom state rather than relying on live network calls or global atoms.
2. **`ComponentName.mdx`** — prose description, a prop table, and `<Canvas>` embeds for every story.
3. **The component file itself.**

## Before opening a PR that adds a component

Confirm all three files are present and Storybook renders each story without errors.

## Every story is a VRT shot

CI's `vrt` job screenshots every story of the **built** Storybook, in `dark` and `light`, and compares it with the last baseline ([decision](../decisions/2026-09-25-vrt-shoots-every-storybook-story-in-both-schemes.md)). So a story has to render the same pixels every time:

- **A dialog or popover story sets `parameters: { isFullViewport: true }`.** The capture clips to `#storybook-root`, and a portalled overlay is outside it, so without this the shot is the trigger button alone.
- **A mocked request goes in `.storybook/mockRoutes.ts`.** The dev server and the built Storybook both answer from that one table.
- **No `Date.now()`, `new Date()` or `Math.random()` in anything the story prints.** Use a fixed timestamp.
- A story that renders nothing at all times out in the capture. Exclude it in `ci.yml` and say why beside it.
