# Storybook Conventions

Every new component **must** ship with three files in the same directory:

1. **`ComponentName.stories.tsx`** — one named export per distinct visual state (`Indeterminate`, `Determinate`, `WithPerFileRows`, `Complete`, etc.). Stories must show the component isolated from page-level concerns; use a Jotai `Provider` + `createStore` to inject atom state rather than relying on live network calls or global atoms.
2. **`ComponentName.mdx`** — prose description, a prop table, and `<Canvas>` embeds for every story.
3. **The component file itself.**

## Before opening a PR that adds a component

Confirm all three files are present and Storybook renders each story without errors.
