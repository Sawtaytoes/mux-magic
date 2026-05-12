# W7E spawn prompt — SubtitleRulesField default-rules preview

Paste the block below into a fresh Claude Code session opened in `d:\Projects\Personal\media-tools`.

---

You are Worker W7E in the React Migration Recovery for media-tools.

**Working directory:** worktree at `.claude/worktrees/w7e` (set up below).
**Branch:** new `fix/default-rules-preview` off `react-migration`; merges back to `react-migration` when done.
**Your model:** Sonnet 4.6, medium effort
**Your role:** Restore the default-rules read-only preview section in `SubtitleRulesField`. When `hasDefaultRules` is checked, the builder must show a collapsible read-only panel **above** the user rules listing the representative default rules, just like the legacy builder. Currently, checking "Has Default Rules" only stores the boolean — nothing renders.

All issues are **[PARITY]** — the legacy builder showed this section; the React port does not.

W7E is parallel with W7A/B/C/D (disjoint files):
- W7A: modal primitives + Storybook reorg
- W7B: LinkPicker bugs
- W7C: sequence runner Content-Type fix
- W7D: PathField typing + PathPicker wiring
- W7E: `SubtitleRulesField.tsx` + `DslRulesBuilder.tsx` (default-rules preview panel only)

## Required reading

1. [docs/react-migration-recovery-handout.md](../react-migration-recovery-handout.md) — Universal Rules.
2. [docs/react-migration-checklist.md](../react-migration-checklist.md) — current state.
3. `packages/web/src/components/SubtitleRulesField/SubtitleRulesField.tsx` — the checkbox and builder wire-up.
4. `packages/web/src/components/DslRulesBuilder/DslRulesBuilder.tsx` — the main builder (predicates + rules).
5. `packages/web/src/components/DslRulesBuilder/RuleCard.tsx` — how individual rules render; read-only rendering path.
6. `packages/web/src/components/DslRulesBuilder/types.ts` — `DslRule` union, `SetScriptInfoRule`, `SetStyleFieldsRule`.
7. `packages/server/src/tools/buildDefaultSubtitleModificationRules.ts` — what the default rules actually contain (read this to understand the data shape you'll hard-code for the preview).

## Worktree setup

```bash
git worktree add .claude/worktrees/w7e -b fix/default-rules-preview react-migration
cd .claude/worktrees/w7e
yarn install
```

## What to build

### Background

`buildDefaultSubtitleModificationRules()` in the server package is computed at runtime from actual `.ass` file metadata. There is no way to call it from the React builder without a real sequence of subtitle files. The legacy builder solved this by rendering a **representative** preview of the rules that most shows need — the typical output of the function — as read-only static `DslRule` objects. This acts as a documentation/preview; the user can see roughly what will happen before running.

### The representative default rules (hard-code these as the preview)

```ts
const DEFAULT_RULES_PREVIEW: DslRule[] = [
  {
    type: "setScriptInfo",
    key: "ScriptType",
    value: "v4.00+",
  },
  {
    type: "setScriptInfo",
    key: "YCbCr Matrix",
    value: "TV.709",
  },
  {
    type: "setStyleFields",
    fields: {
      MarginV: "90",
      MarginL: "210",
      MarginR: "210",
    },
    ignoredStyleNamesRegexString: "signs?|op|ed|opening|ending",
  },
]
```

These are the *typical* defaults for a 1080p fansub series. The actual runtime values are computed from the real files, but this preview is close enough for the user to understand the intent.

### Where to add it

In `SubtitleRulesField.tsx`, when `hasDefaultRules` is `true`, render a collapsible section **above** `<DslRulesBuilder step={step} />`. The section should:

1. Start **expanded** by default (the user should see it when they check the box)
2. Have a toggle `<details>`/`<summary>` (or a plain chevron button + `useState(true)`) — the legacy UI used `<details>` natively
3. Header text: `"Default rules (applied before user rules; read-only):"`
4. Color: amber text (`text-amber-400`) to distinguish from editable rules
5. Content: render each rule in `DEFAULT_RULES_PREVIEW` using `<RuleCard>` with `isReadOnly={true}`
6. The `<RuleCard>` needs `rules`, `ruleIndex`, `rule`, `predicates`, `isReadOnly`, `isFirst`, `isLast`, `stepId`, `openDetailsKeys`, `onToggleDetails`, and `onCommitRules` props. Pass:
   - `rules={DEFAULT_RULES_PREVIEW}` (the full array for index bounds)
   - `predicates={}` (no predicates for default rules)
   - `isReadOnly={true}`
   - `isFirst={ruleIndex === 0}`, `isLast={ruleIndex === DEFAULT_RULES_PREVIEW.length - 1}`
   - `onCommitRules={() => {}}` (no-op; read-only)
   - `openDetailsKeys={new Set()}` + `onToggleDetails={() => {}}` (no expansion needed for read-only preview)

### Where to define the constant

Define `DEFAULT_RULES_PREVIEW` **inside** `SubtitleRulesField.tsx` as a module-level `const`. Do not create a separate file — this is the only consumer.

### Suggested structure in SubtitleRulesField.tsx

```tsx
import type { DslRule } from "../DslRulesBuilder/types"
import { RuleCard } from "../DslRulesBuilder/RuleCard"

const DEFAULT_RULES_PREVIEW: DslRule[] = [
  /* ... as above ... */
]

export const SubtitleRulesField = ({ field, step }: ...) => {
  const [previewOpen, setPreviewOpen] = useState(true)
  // ...

  return (
    <div className="mb-2">
      {/* existing label + checkbox row */}
      {hasDefaultRules && (
        <div className="mt-2 mb-3 border border-amber-800/50 rounded px-3 py-2 bg-amber-950/20">
          <button
            type="button"
            onClick={() => setPreviewOpen((prev) => !prev)}
            className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 w-full text-left mb-1"
          >
            {previewOpen ? "▾" : "▸"}
            {"Default rules (applied before user rules; read-only):"}
          </button>
          {previewOpen && (
            <div className="space-y-2">
              {DEFAULT_RULES_PREVIEW.map((rule, ruleIndex) => (
                <RuleCard
                  key={ruleIndex}
                  rules={DEFAULT_RULES_PREVIEW}
                  ruleIndex={ruleIndex}
                  rule={rule}
                  predicates={{}}
                  isReadOnly={true}
                  isFirst={ruleIndex === 0}
                  isLast={ruleIndex === DEFAULT_RULES_PREVIEW.length - 1}
                  stepId={step.id}
                  openDetailsKeys={new Set()}
                  onToggleDetails={() => {}}
                  onCommitRules={() => {}}
                />
              ))}
            </div>
          )}
        </div>
      )}
      <DslRulesBuilder step={step} />
    </div>
  )
}
```

## Tests to write

In `SubtitleRulesField.test.tsx`, add:

1. **"renders default rules preview when hasDefaultRules is true"** — render `SubtitleRulesField` with a step that has `params.hasDefaultRules: true`. Assert:
   - The preview section heading text `"Default rules"` is in the document
   - At least one rule card with `"setScriptInfo"` text is visible
   - A `"read-only"` label is present (RuleCard renders this text when `isReadOnly`)
2. **"hides default rules preview when hasDefaultRules is false"** — render with `params.hasDefaultRules: false` (or absent). Assert the preview heading is NOT in the document.
3. **"preview section is collapsible"** — render with `hasDefaultRules: true`, find the toggle button, click it, assert the rule cards disappear. Click again, assert they reappear.

No snapshot tests. Inline assertions only (per AGENTS.md).

## Pre-push gate (Universal Rule #2)

Before every commit:

```bash
yarn test run
yarn typecheck
yarn lint
```

All three green.

## Forbidden (Universal Rule #4)

No `toMatchSnapshot`, no `toMatchInlineSnapshot`, no `toHaveScreenshot`.

## Checklist updates (Universal Rule #8)

- At start: mark W7E 🔄 In Progress in [docs/react-migration-checklist.md](../react-migration-checklist.md).
- Per commit: append to Progress Log.
- At end: mark W7E ✅ Done with a one-line summary.

## Handoff

```bash
cd .claude/worktrees/w7e
yarn test run && yarn typecheck && yarn lint
git push origin fix/default-rules-preview
```

Open a PR `fix/default-rules-preview` → `react-migration`.

## When done

Reply with:
- Commit SHAs
- Screenshot (or describe) what the preview section looks like when expanded vs collapsed
- Test count (before → after)
- Pre-push gate state
