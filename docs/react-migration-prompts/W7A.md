# W7A spawn prompt — Storybook reorganization + Modal primitive extraction

Paste the block below into a fresh Claude Code session opened in `d:\Projects\Personal\media-tools`.

---

You are Worker W7A in the React Migration Recovery for media-tools.

**Working directory:** worktree at `.claude/worktrees/w7a` (set up below).
**Branch:** new `feat/storybook-reorg` off `react-migration`; merges back to `react-migration` when done.
**Your model:** Sonnet 4.6, medium effort
**Your role:** Three Storybook-flavored improvements the user flagged during verification. Refactor + reorganize + add a missing story. All three streams in one worker because they share Storybook scope and likely touch overlapping files.

W7A runs **after Phase 5 is fully landed** (W5A/W5B/W5C all merged — confirmed). W7A can run in parallel with W6A, W7B, and W7C since the file ownership is disjoint:
- W6A: `e2e/*.spec.ts`
- W7A: modal primitives + Storybook config + one new story
- W7B: `LinkPicker.tsx` + `LinkPicker.test.tsx` + `links.ts`
- W7C: `useBuilderActions.ts` + `sequenceAtoms.ts` + `sequenceRunner.ts`

## Required reading

1. [docs/react-migration-recovery-handout.md](../react-migration-recovery-handout.md) — Universal Rules (especially #4 no snapshot/VRT, #8 keep checklist honest).
2. [docs/react-migration-checklist.md](../react-migration-checklist.md) — current state.
3. The `.stories.tsx` files for each modal: `LoadModal`, `YamlModal`, `CommandHelpModal`, `ApiRunModal`, `PromptModal`, `LookupModal`, `FileExplorerModal`. Note the patterns each currently uses (Storybook `title:` field, decorators, etc.).
4. The modal component implementations themselves (`*.tsx`) — note the shared patterns: backdrop click handler, Esc key handler, portal mount, focus trap (if any).

## Worktree setup

```bash
git worktree add .claude/worktrees/w7a -b feat/storybook-reorg react-migration
cd .claude/worktrees/w7a
yarn install
```

## Stream 1 — Extract a base Modal primitive

**Why this stream is high-value (two reasons, both user-articulated):**

1. **AI workers fix problems asymmetrically** — one modal gets a bug fix, the others don't. A unified primitive **lowers the testing surface** to one component. The user only verifies the primitive deeply; specialized modals trust the primitive. This is the *primary* motivation for this stream, not generic DRY-for-the-sake-of-DRY.

2. **Storybook-as-verification-harness** — in Storybook, clicking the folder icon inside a `PathField` story will NOT open the `FileExplorerModal` (modals live in their own stories). When the user verifies the modal, they navigate to the modal's story directly. Stream 2's regrouping plus a unified primitive means the user has a clear `Modals/` folder in Storybook with a single canonical primitive story PLUS one per specialized modal. Navigation efficiency = verification efficiency.

The current modal components (`LoadModal`, `YamlModal`, `CommandHelpModal`, `ApiRunModal`, `PromptModal`, `LookupModal`, `FileExplorerModal`) each reimplement the same scaffolding:

- Backdrop div with `bg-black/70` and click-to-close (using `event.target === event.currentTarget` guard)
- Inner content div with `stopPropagation`
- Escape key handler via `document.addEventListener("keydown", ...)`
- Portal mount via `createPortal(..., document.body)` (some) or render-in-place (others — verify)

Extract this into a base primitive. Suggested API:

```tsx
<Modal isOpen={...} onClose={...} ariaLabel="...">
  {children}
</Modal>
```

Suggested location: `packages/web/src/components/primitives/Modal/Modal.tsx` (or wherever existing primitives like `Popover.tsx` live). Standard `<Component>/<Component>.tsx + .test.tsx + .stories.tsx + .mdx` triple.

Then refactor each modal to use the primitive:

```tsx
export const LoadModal = () => {
  const [isOpen, setIsOpen] = useAtom(loadModalOpenAtom)
  return (
    <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} ariaLabel="Load YAML">
      {/* modal content */}
    </Modal>
  )
}
```

**Don't get fancy:** focus trap, scroll lock, and animation are nice-to-haves; if the legacy modals didn't have them, parity > polish. The user's stated goal is "a generic Modal entity" — start there.

**Tests:** the primitive needs its own tests (backdrop click closes; Esc closes; click inside content doesn't close). Existing per-modal tests should keep passing.

Commits suggested:
1. `feat(primitives): add Modal primitive (backdrop + Esc + portal)`
2. `refactor(modals): LoadModal uses Modal primitive`
3. `refactor(modals): YamlModal uses Modal primitive`
4. ... (one commit per migrated modal, keeps each easy to revert)

## Stream 2 — Storybook reorganization

User reported: fields (`BooleanField`, etc.) appear under "Components" in Storybook, alongside other components like `ApiRunModal`. They want clean separation:

- **Fields/** — every form field (`BooleanField`, `NumberField`, `StringField`, `EnumField`, `LanguageCodeField`, `LanguageCodesField`, `StringArrayField`, `NumberArrayField`, `JsonField`, `PathField`, `NumberWithLookupField`, `FolderMultiSelectField`, `SubtitleRulesField`)
- **Modals/** — every modal (`LoadModal`, `YamlModal`, `CommandHelpModal`, `ApiRunModal`, `PromptModal`, `LookupModal`, `FileExplorerModal`, plus the new `Modal` primitive from Stream 1)
- **Pickers/** — `CommandPicker`, `EnumPicker`, `LinkPicker`, `PathPicker`
- **Pages/** — `BuilderPage`, `JobsPage` (W5A added these)
- **Components/** — everything else (StepCard, GroupCard, PathVarCard, FieldLabel, FieldTooltip, JobCard, PageHeader, icons, etc.)

The change is mechanical: edit each `.stories.tsx` file's `meta.title` field.

```tsx
// Before
const meta: Meta<typeof BooleanField> = {
  title: "Components/BooleanField",
  ...
}
// After
const meta: Meta<typeof BooleanField> = {
  title: "Fields/BooleanField",
  ...
}
```

Audit all `.stories.tsx` files; update each. The story content itself is unchanged — only the title prefix.

Commit: `chore(storybook): regroup stories into Fields/Modals/Pickers/Pages/Components`.

## Stream 2.5 — Known broken modal stories (fold into Stream 1's migration)

Stories that don't render their modal when navigated to in Storybook (the modal's `isOpen` atom is `false` by default, so the modal returns `null`):

- **CommandHelpModal** — user-reported during verification. Needs the same fix W5B applied to YamlModal: set `commandHelpModalOpenAtom` to `true` (and `commandHelpCommandNameAtom` to a real command name) in the story decorator.
- Audit the other modal stories for the same bug while you're in there: `ApiRunModal`, `PromptModal`, `LookupModal`, `FileExplorerModal`. YamlModal is already fixed (W5B). LoadModal — verify.

Fold these fixes into the Stream 1 commit that migrates each modal to use the Modal primitive (you'll be touching the story file anyway). No separate stream needed.

## Stream 3 — Find and add story for the missing toggle/switch

User reported: there's a UI element that "looks like a light switch — it has an on or off state" but no story for it. The component isn't obvious from a grep:

- A grep for `switch|toggle|Switch|Toggle` in `packages/web/src/components/*.tsx` matched only JavaScript `switch` statements (FieldDispatcher, etc.), no dedicated component.

**Investigation lead:** the most likely candidate is **`GroupCard`'s sequential-vs-parallel toggle** — a group can be sequential (run steps in order) or parallel (run steps concurrently), and the UI element for that is probably the "light switch" the user described. Look at `packages/web/src/components/GroupCard/GroupCard.tsx` for an inline element that mimics a switch.

Other candidates to check:
- `StepCard` enable/disable toggle (if any)
- A "dry-run" toggle in `PageHeader` (per `uiAtoms.ts` having a `dryRunAtom`)
- A "failure mode" toggle (also in `uiAtoms.ts`)

**What to deliver:**
1. Identify the actual toggle element (probably extract from `GroupCard` if it's inline).
2. If it's a reusable pattern, extract as `packages/web/src/components/primitives/Switch/Switch.tsx` (standard triple of `.tsx + .test.tsx + .stories.tsx`).
3. If it's truly one-off (only used in `GroupCard`), add a story for `GroupCard` that shows the toggle in both on and off states.
4. Either way, the story title goes under `Fields/Switch` or `Components/Switch` (your call — match Stream 2's grouping).

Commit: `feat(stories): add Switch component story` (or `feat(stories): GroupCard story shows parallel/sequential toggle states`).

## Pre-push gate (Universal Rule #2)

Before every commit:

```bash
yarn test run
yarn typecheck
yarn lint
```

All three green. The Storybook stories themselves are vitest-runnable via `test:storybook` — those should pass too.

## Forbidden (Universal Rule #4)

No `toMatchSnapshot`, no `toMatchInlineSnapshot`, no `toHaveScreenshot`. Storybook tests use semantic assertions (`expect(screen.getByRole(...)).toBeVisible()`, etc.).

## Checklist updates (Universal Rule #8)

- At start: mark W7A 🔄 In Progress in [docs/react-migration-checklist.md](../react-migration-checklist.md).
- Per commit: append to Progress Log.
- At end: mark W7A ✅ Done with a one-line summary per stream.

## Handoff (post-completion)

```bash
cd .claude/worktrees/w7
yarn test run && yarn typecheck && yarn lint
git push origin feat/storybook-reorg
```

Open a PR `feat/storybook-reorg` → `react-migration` (or merge directly per repo convention).

After merge:

```bash
cd ../..
git worktree remove .claude/worktrees/w7a
git branch -d feat/storybook-reorg
```

## When done

Reply with:
- Commit SHAs grouped by stream
- The Modal primitive's final API (what props you settled on)
- The toggle/switch verdict — what component was it, did you extract a primitive or just add a story
- Number of `.stories.tsx` files re-grouped (Stream 2 count)
- Pre-push gate state
