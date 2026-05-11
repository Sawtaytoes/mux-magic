# W5C spawn prompt — Restore command field tooltips (data restoration)

Paste the block below into a fresh Claude Code session opened in `d:\Projects\Personal\media-tools`.

---

You are Worker W5C in the React Migration Recovery for media-tools.

**Working directory:** worktree at `.claude/worktrees/w5c` (set up below).
**Branch:** new `feat/restore-tooltips` off `react-migration`; merges back to `react-migration` when done.
**Your model:** Sonnet 4.6, medium effort
**Your role:** Restore the per-field `description` data that used to populate hover tooltips on the (ⓘ) info icons. The UI is wired correctly (Wave A-3 shipped `FieldTooltip` with portal + 200ms hover delay + correct empty-render behavior). The **schema data is missing** — every field in `packages/web/src/commands/commands.ts` has zero `description:` entries.

W5C runs **in parallel with W5A and W5B** — file ownership is disjoint:

- W5A: JsonField, MDX prose, 4 bridge atoms, page-stories, buildBuilderUrl audit
- W5B: StepCard, GroupCard, useDragAndDrop, runOrStopStep atom, version footer (NEW)
- W5C: `packages/web/src/commands/commands.ts` only, plus possibly a server-side build script if one is wired

## Required reading

1. [docs/react-migration-recovery-handout.md](../react-migration-recovery-handout.md) — Universal Rules.
2. [docs/react-migration-checklist.md](../react-migration-checklist.md) — current Phase 5 state. W5A/W5B run alongside you.
3. [packages/web/src/components/FieldTooltip/FieldTooltip.tsx](../../packages/web/src/components/FieldTooltip/FieldTooltip.tsx) — confirms the UI contract: a `description: string` prop; renders nothing when empty.
4. [packages/web/src/commands/commands.ts](../../packages/web/src/commands/commands.ts) — your target. Currently has zero `description:` fields.
5. Find the caller that threads `description` into `FieldTooltip` — likely in `RenderFields.tsx` or `FieldLabel.tsx`. Verify it reads from the `field.description` (or equivalent) property.

## Worktree setup

```bash
git worktree add .claude/worktrees/w5c -b feat/restore-tooltips react-migration
cd .claude/worktrees/w5c
yarn install
```

## Investigation phase (do this first)

Two hypotheses for where descriptions used to live:

**A. In the legacy `commands.js` directly.** W1's TS port (commit `8e88877`) may have stripped descriptions accidentally. Recovery is mechanical:

```bash
git show 7b92c62^:packages/web/public/builder/js/commands.js > /tmp/legacy-commands.js
# scan for description: lines or similar property names
grep -n "description\|tooltip\|help" /tmp/legacy-commands.js | head -40
```

If descriptions exist in legacy `commands.js`, your job is to merge them into `commands.ts` field-by-field. This is the **happy path** — the AI-authored content is recoverable in git history.

**B. From a server-side build script.** W4A's audit annotated `getCommandFieldDescription` as "server build script (implemented)." If descriptions live on the server and are injected at runtime/build-time, the React app may need an API call or build step to fetch them.

Search the server package:

```bash
grep -rn "getCommandFieldDescription\|fieldDescription" packages/server/src
```

Determine which hypothesis is real before writing code. **The mechanical recovery (Hypothesis A) is preferred** because it keeps the data in version control where it belongs. If Hypothesis B applies, evaluate whether to:
- Keep the server script as the source and call it at build time (generating `commands.ts` from the script's output)
- Move the descriptions into `commands.ts` directly and retire the server script

Document the chosen approach in the commit message.

## Restoration phase

For each of the 31 commands in `commands.ts`, every `fields[].description` should be filled with a short user-facing string explaining what the field does. Keep them factual and concise — the legacy tooltips were ~1-2 sentences. Examples (guessed):

```ts
{
  name: "audioLanguages",
  type: "languageCodes",
  label: "Audio languages",
  description: "Three-letter ISO 639-2 codes of audio tracks to keep. All other audio is removed.",
  ...
}
```

If a legacy description exists, use it verbatim. Only generate new content for fields where the legacy text is genuinely lost.

Wave B's frozen test fixture at `packages/web/src/commands/__fixtures__/commands.ts` may need a parallel update if it contains stripped-down command definitions and any test asserts on descriptions. Check before changing.

## Verify the wire-up works

After data is restored:

1. `yarn dev`
2. Open `/builder` → pick a command → hover the (ⓘ) icon on a field → tooltip should appear.
3. Verify in Storybook that `FieldTooltip` stories still render correctly (they may already cover this).
4. If the tooltip isn't appearing despite data being present, the issue is in the wire-up between `commands.ts → field.description → FieldTooltip` — investigate `RenderFields.tsx` and `FieldLabel.tsx` to ensure `description` is threaded through.

## Pre-push gate (Universal Rule #2)

```bash
yarn test run
yarn typecheck
yarn lint
```

All three must pass.

## Commit cadence

Suggested:
1. `chore(commands): recover field descriptions from legacy commands.js` (or `feat(commands): re-author field descriptions where legacy text was lost`)
2. `feat(builder): thread field.description into FieldTooltip via RenderFields/FieldLabel` (only if wire-up needs fixing)
3. `test(commands): verify all 31 commands have non-empty field descriptions` (a guard test that prevents this regression from recurring)

The guard test is **important** — it stops a future port from stripping descriptions silently. Suggested shape:

```ts
test("every command field has a non-empty description (regression guard)", () => {
  Object.entries(COMMANDS).forEach(([commandName, def]) => {
    def.fields.forEach((field) => {
      expect(field.description, `${commandName}.${field.name}`).toBeTruthy()
    })
  })
})
```

## Checklist updates (Universal Rule #8)

- At start: mark W5C 🔄 In Progress in [docs/react-migration-checklist.md](../react-migration-checklist.md).
- Per commit: append to Progress Log.
- At end: mark W5C ✅ Done with a summary (descriptions restored from legacy / re-authored / mixed, count).

## Forbidden (Universal Rule #4)

No snapshot tests. No screenshot tests. Inline assertions only.

## When done

Reply with:
- Hypothesis verdict (legacy recovery, server-script-driven, or mixed)
- Count of fields restored verbatim from legacy vs newly authored
- Wire-up status (was the threading already correct, or did you fix it?)
- Commit SHAs
- Pre-push gate state
- Any commands where you couldn't recover or confidently author a description (defer those to a future polish pass)

The orchestrator will then mark Phase 5 (W5A + W5B + W5C) for re-merge consideration once all three report green.
