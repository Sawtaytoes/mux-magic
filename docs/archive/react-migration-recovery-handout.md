# React Migration Recovery — Worker Handout

> **How to use this doc:** Find your **Worker ID** in the Assignment Table below. Read the **Universal Rules** section (it applies to you). Then jump to your worker section. Each worker section is self-contained — you do not need to read other workers' sections.

---

## Context

The Mux-Magic React migration is partially complete and out of sync with its own checklist. The original plan ran *Waves* sequentially with *components within a wave* parallelized via worktrees, but the execution got inverted: work happened in undocumented order, several "Done" checklist entries don't reflect reality, and the builder page still loads ~80 vanilla JS files via legacy `<script>` tags.

**The audit (confirmed 2026-05-10):**
- [packages/web/public/builder/index.html](packages/web/public/builder/index.html) still loads legacy scripts; React only adds modals as overlays.
- [packages/web/public/index.html](packages/web/public/index.html) (jobs entry) still loads `/jobs/main.js`.
- [packages/web/src/jobs/yamlSerializer.ts](packages/web/src/jobs/yamlSerializer.ts) line 16 calls `window.mediaTools?.buildParams` — implementation in [packages/web/public/builder/js/sequence-editor.js](packages/web/public/builder/js/sequence-editor.js) (~line 723).
- [packages/web/src/components/RenderFields/RenderFields.tsx](packages/web/src/components/RenderFields/RenderFields.tsx) is a "Wave B pending" placeholder.
- Wave B-0 (RenderFields dispatcher) and Wave B (12+ field types) were never started.
- `yamlSerializer.ts` and `loadYaml.ts` are **not duplicates** — they do opposite operations. Keep separate.
- Stale `.claude/worktrees/{retire-bridge,wave-a-leaf-components,wave-a4-leaf-components,wave-c,wave-d-cards,wave-e,wave-f-jobs-page}` are filesystem-orphans (not real git worktrees).
- Stale local branches: `worktree-wave-a-leaf-components`, `t3code/53e531b5`.

**Goal:** 100% React, no vanilla JS dependency, full unit + component test coverage, e2e tests deferred.

---

## Universal Rules — ALL WORKERS READ THIS

These rules apply to every worker. No exceptions.

### 1. Trunk = `react-migration`
- All work commits to `react-migration`. Master stays untouched until Phase 4 final merge.
- No worker creates a new branch unless their section explicitly says so. Parallel work is file-separated on the same branch.
- Before every push: `git pull --rebase origin react-migration`.

### 2. Pre-Push Gate (Every Commit, Every Worker)
Before pushing **any** commit, all three must pass:
```bash
yarn test run
yarn typecheck
yarn lint
```
If any fail, fix before pushing. If you can't resolve, stop and add an "open question" entry to [docs/react-migration-checklist.md](docs/react-migration-checklist.md). Do not push broken commits.

### 3. Commit-and-Push as You Go
Small commits, push after each logical group. Do not batch a day's work into one commit.

### 4. NO SNAPSHOT TESTS. NO SCREENSHOT TESTS.
- Never use `toMatchSnapshot()`, `toMatchInlineSnapshot()`, Playwright `toHaveScreenshot()`, Percy, Chromatic, or Storybook screenshot addons.
- All test assertions must spell out the expected value inline: `expect(x).toBe("literal string")` or `expect(x).toEqual({ explicit: "object" })`.
- Reason: snapshot diffs hide intent and get rubber-stamped during auto-update. There is no VRT platform in this repo. Visual verification is manual via Storybook and the dev server.

### 5. AGENTS.md Code Rules
- No `for`/`for...of`/`while` loops — use `forEach`/`map`/`filter`/`reduce`.
- `const` only; no `var`; no `let` reassignment.
- No single-letter variables or abbreviations. Spell every name out.
- Booleans start with `is` or `has`.
- Arrow functions with implicit returns where possible.
- No barrel files (except `packages/shared/src/index.ts`).

### 6. Yarn, Not npm
- Always `yarn` and `yarn dlx`. Never `npm` or `npx`. The user has corrected this repeatedly.

### 7. Use the `Edit` Tool for Shared Files
- If your section says you edit a file that other workers also edit (notably `RenderFields.tsx` dispatcher switch), use the `Edit` tool with surgical changes — never `Write` the whole file.

### 8. Keep the Checklist Honest (NON-NEGOTIABLE)
The prior migration failed because the checklist drifted from reality. To prevent this:

- **Single source of truth:** [docs/react-migration-checklist.md](docs/react-migration-checklist.md). No parallel docs.
- **When you START your worker section:** edit the checklist to mark your row as `🔄 In Progress` with the date and your model name. Commit and push as `chore(checklist): W<your-id> in progress`.
- **After every commit you push:** update the checklist's "Progress Log" sub-section with one line: `W<id> | <date> | <commit short message>`. This is part of the same commit as your code change — do not split it.
- **When you FINISH and verify the pre-push gate:** edit the checklist to mark your row as `✅ Done` with the date and a one-line summary of what shipped. Commit as `chore(checklist): W<your-id> complete`.
- **If you escalate or get blocked:** edit the checklist to mark your row as `⚠️ Blocked` with the reason. Then notify the user.

The checklist format is defined under [#checklist-template] below — use it verbatim.

---

## Worker Assignment Table

| Worker | Phase | What | Model | Effort | Runs After | Branch |
|---|---|---|---|---|---|---|
| **Pre-W0** | — | Orchestrator (Claude in current session) updates AGENTS.md with no-snapshot / no-VRT rules | (orchestrator) | — | (immediate, before any worker spawns) | `react-migration` |
| **W0a** | 0 | Stale-cleanup: delete `.claude/worktrees/` dirs + stale local branches + scaffold checklist file | Haiku | Thinking ON | Pre-W0 | `react-migration` |
| **W0b** | 0 | Audit: confirm dev env runs; inspect partial component dirs; record findings in checklist | Sonnet | Low | Pre-W0 (parallel with W0a, W0c) | `react-migration` |
| **W0c** | 0 | Parity capture: collect reference YAML + input JSON for every command | Sonnet | Medium | Pre-W0 (parallel with W0a, W0b) | `react-migration` |
| **W1** | 1 | Wave B-0: RenderFields dispatcher + commands.ts + buildParams + shared helpers | Sonnet | Medium | W0a + W0b + W0c all done | `react-migration` |
| **W2A** | 2 | Bundle A: BooleanField, NumberField, StringField | Haiku | Thinking ON | W1 | `react-migration` (parallel) |
| **W2B** | 2 | Bundle B: EnumField, LanguageCodeField, LanguageCodesField | Haiku | Thinking ON | W1 | `react-migration` (parallel) |
| **W2C** | 2 | Bundle C: StringArrayField, NumberArrayField, JsonField | Haiku | Thinking ON | W1 | `react-migration` (parallel) |
| **W2D** | 2 | Bundle D: PathField, NumberWithLookupField, FolderMultiSelectField, SubtitleRulesField, DslRulesBuilder | Haiku | Thinking ON | W1 | `react-migration` (parallel) |
| **W3** | 3 | Final cleanup: delete bridge, delete public/builder/, replace public/index.html, collapse createRoot | Sonnet | Medium | W2A + W2B + W2C + W2D + W2.5 all done | `react-migration` |
| **W4A** | 4 | Parity verification + checklist audit + merge react-migration → master | Sonnet | Medium | W3 | `react-migration` → `master` (parallel with W4B) |
| **W4B** | 4 | E2E tests (Playwright) — authored in `e2e/` worktree off post-W3 react-migration | Sonnet | Medium | W3 (parallel with W4A) | worktree off `react-migration`, merges to `master` after W4A |
| **W5** | 5 | Parity-trap + code-smell + a11y cleanup (formerly W6) | Sonnet | High | W4A + W4B both done | `master` |

**Parallel groups:**
- **W0a, W0b, W0c** — all three start after Pre-W0, run concurrently on `react-migration`. They touch disjoint files.
- **W2A, W2B, W2C, W2D** — all four start after W1, run concurrently on `react-migration`. They share `RenderFields.tsx` only (one `case` block each).
- **W4A + W4B** — both start after W3. W4A stays on `react-migration` for verification + master merge. W4B uses a worktree off `react-migration` and only writes files under `e2e/`. **Coordination:** W4B must NOT modify `package.json` or `yarn.lock` without coordinating with W4A (Playwright is already installed; if a new dep is needed, ping the orchestrator). After W4A merges to master, W4B rebases their worktree branch onto master and merges when done.

**Naming note:** Phase 4 was originally a single W4 (verification+merge) followed by W5 (e2e). They've been renamed W4A and W4B to match the parallel-pair pattern from Phase 2 (W2A–W2D). The cleanup worker formerly known as W6 is now W5 (next phase). Commit history may still mention W4/W5/W6 by their old labels.

---

## How You (the Orchestrator) Monitor Progress

You don't need to interrupt workers — they keep the checklist honest as part of their workflow (see Universal Rule #8). To check status at any time:

1. **Open [docs/react-migration-checklist.md](docs/react-migration-checklist.md).** The top table shows every worker's status (`⬜ Not Started`, `🔄 In Progress`, `✅ Done`, `⚠️ Blocked`).
2. **Scan the "Progress Log"** at the bottom — newest entries are last. Each line is one push: `W<id> | <date> | <commit message>`. This tells you exactly what shipped without reading git history.
3. **Look for ⚠️ Blocked rows** — these need your attention. Workers add a "reason" line next to the status so you can act without re-deriving context.
4. **Read the per-worker sub-checklists** — each phase has a `[ ] step-name` list. You can see exactly how far through their steps a worker is.

If you ever suspect a worker has fallen out of sync with the checklist, that's an emergency — the same failure mode that triggered this whole recovery. Stop new work, do a W4A-style audit on whatever's claimed Done, and reconcile.

---

# PRE-W0 — Orchestrator Task (Claude in current session)

**Who:** The session that approves this plan (me — Claude). **When:** Immediately after plan approval, before spawning W0a/W0b/W0c. **Why pulled out of W0:** Has no dependency on any other Phase 0 work; landing it first means every downstream worker reads the updated AGENTS.md before writing tests.

## The single task

Add a new section to [AGENTS.md](AGENTS.md) under the testing rules. Use exactly these two bullets:

> **No snapshot tests.** Never use `toMatchSnapshot`, `toMatchInlineSnapshot`. Spell expected values out inline: `expect(x).toBe("literal string")` or `expect(x).toEqual({ explicit: "object" })`. Reason: snapshot diffs hide intent and get rubber-stamped during auto-update.
>
> **No screenshot / visual regression tests.** Never use Playwright `toHaveScreenshot`, Percy, Chromatic, or Storybook screenshot addons. There is no VRT platform in this repo. Visual verification is manual via Storybook and the dev server.

## Verification

```bash
yarn lint
```

## Commit

`docs(agents): add no-snapshot and no-VRT rules`

## Handoff

W0a, W0b, W0c can spawn immediately after this commit lands.

---

# WORKER W0a — Stale Cleanup + Checklist Scaffold

**Model:** Haiku · **Thinking:** ON · **Branch:** `react-migration` · **Prerequisite:** Pre-W0 done · **Parallel with:** W0b, W0c

## Your Mission

Delete stale work and create the empty checklist file that W0b, W0c, and all subsequent workers update.

## Step-by-Step

### Step 1 — Delete filesystem-orphan worktree dirs

These are not real git worktrees (verified via `git worktree list` showing only the main worktree). They're stale copies from earlier parallel work.

```powershell
Remove-Item -Recurse -Force .claude/worktrees/retire-bridge
Remove-Item -Recurse -Force .claude/worktrees/wave-a-leaf-components
Remove-Item -Recurse -Force .claude/worktrees/wave-a4-leaf-components
Remove-Item -Recurse -Force .claude/worktrees/wave-c
Remove-Item -Recurse -Force .claude/worktrees/wave-d-cards
Remove-Item -Recurse -Force .claude/worktrees/wave-e
Remove-Item -Recurse -Force .claude/worktrees/wave-f-jobs-page
```

If any path doesn't exist, skip it silently.

### Step 2 — Delete stale local branches (only if safe)

First confirm they have no unpushed commits:

```bash
git log worktree-wave-a-leaf-components --not --remotes
git log t3code/53e531b5 --not --remotes
```

If either has unpushed commits, **STOP**, mark your row ⚠️ Blocked in the checklist, and ask the user. Otherwise:

```bash
git branch -D worktree-wave-a-leaf-components
git branch -D t3code/53e531b5
```

### Step 3 — Create the checklist scaffold

Create [docs/react-migration-checklist.md](docs/react-migration-checklist.md) using the **Checklist Template** at the bottom of this plan. Fill in:
- Today's date in "Last updated"
- Your worker ID and model in "Last updated"
- All worker rows with ⬜ Not Started, then mark W0a as ✅ Done (since by the time you push this commit, your work is finished)
- Leave audit findings and W2D escalation status as `<TBD by W0b>` / `<TBD by W2D>` placeholders

## Verification Before You Push

```bash
yarn test run && yarn typecheck && yarn lint
```

## Commits (push each immediately)

1. `chore: remove stale .claude/worktrees and local branches`
2. `docs: scaffold react-migration-checklist (Phase 0 progress tracker)`

## Handoff

When both commits are pushed: W0b and W0c continue (they can already be running in parallel — they don't depend on W0a finishing, but they DO depend on Pre-W0 being done so they can read AGENTS.md).

---

# WORKER W0b — Audit Existing State

**Model:** Sonnet · **Effort:** Low · **Branch:** `react-migration` · **Prerequisite:** Pre-W0 done · **Parallel with:** W0a, W0c

## Your Mission

Establish the audit findings the checklist needs: dev env runs, and what's actually inside the partial component directories.

## Step-by-Step

### Step 1 — Confirm dev environment runs

```bash
yarn install
yarn dev
```

Open `http://localhost:5173/` (or via Hono on :3000 if that's the entry — check the dev script in [package.json](package.json)). Verify `/` and `/builder` both load without console errors. Capture any errors verbatim for the checklist.

### Step 2 — Inspect existing partial component directories

For each of:
- `packages/web/src/components/EnumField/`
- `packages/web/src/components/LanguageCodeField/`
- `packages/web/src/components/PathField/`
- `packages/web/src/components/NumberField/`

Read every file inside. Classify each directory as:
- **empty/stub** — placeholder content only, no real implementation
- **partial** — some real implementation but not wired into RenderFields dispatcher
- **wired** — a working component already used in the app

Do NOT modify any of these directories — W2A–W2D will extend them based on your findings.

### Step 3 — Record findings in the checklist

Wait for W0a's checklist scaffold commit to land (or git pull --rebase to pick it up). Edit [docs/react-migration-checklist.md](docs/react-migration-checklist.md):

- Fill in the "Phase 0 audit findings" sub-section under W0b with your classifications for each directory.
- If you found any unexpected drift (e.g. checklist says Wave A "Done" but a component file is missing), record it under "Other anomalies".
- Mark W0b as ✅ Done.

## Verification Before You Push

```bash
yarn test run && yarn typecheck && yarn lint
```

## Commits (push each immediately)

1. `docs(checklist): record W0b audit findings — partial component dir classification`

## Handoff

When the commit is pushed and W0c is also done: W1 can start. Notify the orchestrator.

---

# WORKER W0c — Parity Reference Capture (TIME-CRITICAL)

**Model:** Sonnet · **Effort:** Medium · **Branch:** `react-migration` · **Prerequisite:** Pre-W0 done · **Parallel with:** W0a, W0b

## Your Mission

Capture YAML output for every command **while the legacy JS still works**. Once W1 replaces `buildParams`, the legacy behavior is no longer observable — this capture window only exists during Phase 0.

## Step-by-Step

### Step 1 — Start the dev server

```bash
yarn install   # safe to run even if W0b is also running it; yarn is idempotent
yarn dev
```

Open the legacy builder at `/builder` (the still-vanilla one).

### Step 2 — Capture YAML for every command

For every command listed in [packages/web/public/builder/js/commands.js](packages/web/public/builder/js/commands.js):

1. In the legacy builder UI, create a step using that command.
2. Fill every field type the command exposes with **realistic-but-deterministic** values. Use the same fixture values for similar field types across commands so diffs are bisectable. Suggested conventions:
   - Strings: `"fixture-string-<fieldname>"`
   - Numbers: `42`, `1024`, `60` (pick something contextually plausible)
   - Booleans: `true`
   - Paths: `@basePath/<commandName>/sample.mkv`
   - Arrays: `["a", "b"]` or `[1, 2]`
3. Use the existing "Copy YAML" action to extract the serialized output.
4. Save the YAML to `packages/web/tests/fixtures/parity/<commandName>.yaml`.
5. Save the input state (paths array + field values you used) as `packages/web/tests/fixtures/parity/<commandName>.input.json`.

These fixtures are committed to git. They become the Phase 4 parity gate.

### Step 3 — Mark yourself done

Edit [docs/react-migration-checklist.md](docs/react-migration-checklist.md) — mark W0c ✅ Done and list how many command fixtures you captured.

## Verification Before You Push

```bash
yarn test run && yarn typecheck && yarn lint
```

The new fixture files don't need to be referenced by tests yet — W1's `buildParams.test.ts` and Phase 4 are the consumers.

## Commits (push each immediately)

1. `test: capture parity reference YAML for all commands (Phase 0 baseline)`
2. `docs(checklist): W0c complete — <N> command fixtures captured`

## Handoff

When both commits are pushed and W0b is also done: W1 can start. Notify the orchestrator.

---

# WORKER W1 — Phase 1: Wave B-0 (Critical Path)

**Model:** Sonnet · **Effort:** Medium · **Branch:** `react-migration` · **Prerequisite:** W0 complete

## Your Mission
You are the critical path. Until you finish, W2A–W2D cannot start. You port command definitions and `buildParams` from vanilla JS into TypeScript, replace the RenderFields placeholder with a real dispatcher, and ship the shared helpers W2A–W2D will consume.

## Step-by-Step

### Step 1 — Port commands.js to TS
Create `packages/web/src/commands/commands.ts`:
- Port [packages/web/public/builder/js/commands.js](packages/web/public/builder/js/commands.js) verbatim.
- Use the existing `Commands` type from [packages/web/src/types.ts](packages/web/src/types.ts).
- Export `export const COMMANDS: Commands = { ... }`.

### Step 2 — Port buildParams
Create `packages/web/src/commands/buildParams.ts`:
- Source: [packages/web/public/builder/js/sequence-editor.js](packages/web/public/builder/js/sequence-editor.js) around line 723.
- Pure function: `(step: Step, paths: PathVar[], commands: Commands) => Record<string, unknown>`.
- Write a `buildParams.test.ts` with explicit inline assertions covering every branch:
  - simple field → params passthrough
  - `links[fieldName] = pathVarId` → resolved to path value with `@` prefix
  - `links[fieldName] = { linkedTo, output }` → resolved to step-output reference
  - `companionNameField` handling
  - `persistedKeys` handling
- Tests use the parity fixtures from W0 step 5 as input, with **inline expected values** (no snapshot tests).

### Step 3 — Port shared helpers
Create `packages/web/src/commands/links.ts`:
- Port `getLinkedValue` from `sequence-editor.js` and any related link-resolution helpers.
- Used by `PathField`, `NumberWithLookupField`, `FolderMultiSelectField`, `SubtitleRulesField` (W2D).

Create `packages/web/src/commands/fieldVisibility.ts`:
- Port [packages/web/public/builder/js/util/field-visibility.js](packages/web/public/builder/js/util/field-visibility.js).
- Used by RenderFields dispatcher (Step 5 below) and individual fields when `visibleWhen` applies.

### Step 4 — Port FieldLabel
Create `packages/web/src/components/FieldLabel/FieldLabel.tsx`, `.test.tsx`, `.stories.tsx`:
- Port [packages/web/public/builder/js/fields/field-label.js](packages/web/public/builder/js/fields/field-label.js).
- W2A–W2D will import this. Do not change its API after they start.

### Step 5 — Replace RenderFields placeholder with real dispatcher
Edit [packages/web/src/components/RenderFields/RenderFields.tsx](packages/web/src/components/RenderFields/RenderFields.tsx):
- Remove the "Wave B pending" placeholder.
- Implement group handling, `visibleWhen` filtering, switch on `field.type`.
- For each field type, render a `<TodoField type="<fieldType>" field={field} />` placeholder component. Create the `<TodoField />` in the same file or alongside.
- W2A–W2D will replace each `<TodoField type="boolean">` etc. with the real `<BooleanField />` etc.
- Pattern source: [packages/web/public/builder/js/fields/render-fields.js](packages/web/public/builder/js/fields/render-fields.js).

### Step 6 — Drop the dynamic JS import in BuilderPage
Edit [packages/web/src/pages/BuilderPage/BuilderPage.tsx](packages/web/src/pages/BuilderPage/BuilderPage.tsx):
- Remove the dynamic `import("/builder/js/commands.js")` block (around `loadCommands`).
- Hydrate the existing `commandsAtom` from the new TS module:
  ```ts
  import { COMMANDS } from "../../commands/commands"
  useHydrateAtoms([[commandsAtom, COMMANDS]])
  ```
- Verify modals mounted via `createPortal(document.body)` still see the hydrated atom (they should if they share the same `Provider`).

### Step 7 — Update yamlSerializer to use TS buildParams
Edit [packages/web/src/jobs/yamlSerializer.ts](packages/web/src/jobs/yamlSerializer.ts):
- Remove the `window.mediaTools?.buildParams` branch (line 13-22).
- Import the new TS `buildParams`.
- Add or update tests with explicit inline expected values.

### Step 8 — Freeze the Phase 2 test fixture
Create `packages/web/src/commands/__fixtures__/commands.ts`:
- Export a stable subset of commands (one per field type, minimum) for W2A–W2D test files.
- After this commit, do not modify this fixture file — W2A–W2D imports must remain stable.

## Verification Before You Push
```bash
yarn test run && yarn typecheck && yarn lint
```
Manual: open `/builder`, command dropdown populates, each step card shows `[TodoField: <type>]` placeholders instead of "Wave B pending".

## Commits (push each immediately)
1. `feat(commands): port COMMANDS to TS`
2. `feat(commands): port buildParams to TS with inline-assertion tests`
3. `feat(commands): port getLinkedValue and fieldVisibility shared helpers`
4. `feat(components): FieldLabel React component`
5. `feat(components): real RenderFields dispatcher with TodoField placeholders`
6. `refactor(builder): hydrate commandsAtom from TS commands module`
7. `refactor(jobs): yamlSerializer uses TS buildParams; drop window.mediaTools branch`
8. `test(commands): freeze __fixtures__/commands.ts for Phase 2 workers`

## Handoff
When all eight commits are pushed and the pre-push gate is green: notify the orchestrator that W2A, W2B, W2C, W2D can start in parallel.

---

# WORKER W2A — Bundle A: Primitives

**Model:** Haiku · **Thinking:** ON · **Branch:** `react-migration` · **Prerequisite:** W1 complete

## Your Fields
1. `BooleanField`
2. `NumberField`
3. `StringField`

## Universal Bundle Rules
Apply to W2A, W2B, W2C, W2D. Read once.

- **Shared touch-point:** [packages/web/src/components/RenderFields/RenderFields.tsx](packages/web/src/components/RenderFields/RenderFields.tsx) dispatcher switch. Use `Edit` tool — never `Write` the whole file. Each bundle owns distinct `case` blocks.
- **Before every push:** `git pull --rebase origin react-migration` — keeps your single-line dispatcher edit on top of other bundles' edits.
- **Shared helpers** (`FieldLabel`, `links.ts`, `fieldVisibility.ts`): import only. Do not modify.
- **Test fixtures:** import from `packages/web/src/commands/__fixtures__/commands.ts` only. Do not add to this file.
- **Existing directories:** Per W0's audit, check the checklist for your fields' current state. If a directory already exists at `src/components/<Field>/`, extend it; otherwise create fresh.
- **Per-field commit:** one field per commit, push immediately.

## Step-by-Step (Repeat for Each Field in Your Bundle)

### For each field (e.g., BooleanField):
1. Read the legacy source: `packages/web/public/builder/js/fields/boolean-field.js`.
2. Check [docs/react-migration-checklist.md](docs/react-migration-checklist.md) for W0's audit note on `src/components/BooleanField/` (if applicable).
3. Create or extend:
   - `packages/web/src/components/BooleanField/BooleanField.tsx`
   - `packages/web/src/components/BooleanField/BooleanField.test.tsx` — with **explicit inline expected values** (no snapshots, no screenshots)
   - `packages/web/src/components/BooleanField/BooleanField.stories.tsx`
4. Edit [packages/web/src/components/RenderFields/RenderFields.tsx](packages/web/src/components/RenderFields/RenderFields.tsx) dispatcher: replace `<TodoField type="boolean" .../>` with `<BooleanField .../>`. Use the `Edit` tool with surgical context.
5. Run the pre-push gate:
   ```bash
   yarn test run && yarn typecheck && yarn lint
   ```
6. Manual: open `/builder`, pick a command exposing this field type, verify it renders and is interactive.
7. `git pull --rebase origin react-migration`
8. Commit: `feat(fields): port BooleanField from vanilla JS to React`
9. Push.

Then repeat for `NumberField`, then `StringField`.

## Handoff
When all three fields are pushed and the pre-push gate is green for the final commit: notify the orchestrator.

---

# WORKER W2B — Bundle B: Enum / Language

**Model:** Haiku · **Thinking:** ON · **Branch:** `react-migration` · **Prerequisite:** W1 complete

## Your Fields
1. `EnumField`
2. `LanguageCodeField`
3. `LanguageCodesField`

## Bundle Rules
See **W2A → Universal Bundle Rules** above. They apply identically.

## Step-by-Step
Follow W2A's per-field recipe, substituting your field names. Legacy sources:
- `packages/web/public/builder/js/fields/enum-field.js`
- `packages/web/public/builder/js/fields/language-code-field.js`
- `packages/web/public/builder/js/fields/language-codes-field.js`

## Handoff
When all three fields are pushed and the pre-push gate is green: notify the orchestrator.

---

# WORKER W2C — Bundle C: Arrays + JSON

**Model:** Haiku · **Thinking:** ON · **Branch:** `react-migration` · **Prerequisite:** W1 complete

## Your Fields
1. `StringArrayField`
2. `NumberArrayField`
3. `JsonField`

## Bundle Rules
See **W2A → Universal Bundle Rules** above. They apply identically.

## Step-by-Step
Follow W2A's per-field recipe, substituting your field names. Legacy sources:
- `packages/web/public/builder/js/fields/string-array-field.js`
- `packages/web/public/builder/js/fields/number-array-field.js`
- `packages/web/public/builder/js/fields/json-field.js`

## Special Note
`JsonField` may require special handling for parse errors / multi-line input. Match legacy behavior exactly — don't improve the error messages or validation rules. Parity is the goal of this phase.

## Handoff
When all three fields are pushed and the pre-push gate is green: notify the orchestrator.

---

# WORKER W2D — Bundle D: Composite (Heaviest)

**Model:** Haiku · **Thinking:** ON · **Branch:** `react-migration` · **Prerequisite:** W1 complete

## Your Fields
1. `PathField`
2. `NumberWithLookupField`
3. `FolderMultiSelectField`
4. `SubtitleRulesField`
5. `DslRulesBuilder`

## Bundle Rules
See **W2A → Universal Bundle Rules** above. They apply identically. Plus:

- You also port [packages/web/public/builder/js/fields/step-output-picker.js](packages/web/public/builder/js/fields/step-output-picker.js) — used by `PathField` and `NumberWithLookupField`.
- You also port [packages/web/public/builder/js/components/dsl-rules-builder.js](packages/web/public/builder/js/components/dsl-rules-builder.js) for `DslRulesBuilder`.

## Step-by-Step
Follow W2A's per-field recipe for `PathField`, `NumberWithLookupField`, `FolderMultiSelectField`, `SubtitleRulesField` first. For each, import `getLinkedValue` from W1's `src/commands/links.ts`.

For `DslRulesBuilder` (largest item):
1. Read [packages/web/public/builder/js/components/dsl-rules-builder.js](packages/web/public/builder/js/components/dsl-rules-builder.js) in full before starting.
2. If after reading it becomes clear this is more than a mechanical port — meaning it needs new Jotai atoms beyond the existing ones, new state-shape decisions, or refactoring of shared helpers — **STOP** and add to [docs/react-migration-checklist.md](docs/react-migration-checklist.md):
   ```
   ## DslRulesBuilder escalation (W2D)
   - Reason: <why this isn't mechanical>
   - Recommended: reassign to Sonnet High effort as Phase 2.5
   ```
   Then notify the orchestrator. Do not push half-finished DslRulesBuilder work.
3. If it is mechanical, port it following the standard per-field recipe.

## Handoff
When all five fields + step-output-picker are pushed and the pre-push gate is green: notify the orchestrator.

---

# WORKER W3 — Phase 3: Final Cleanup

**Model:** Sonnet · **Effort:** Medium · **Branch:** `react-migration` · **Prerequisite:** W2A + W2B + W2C + W2D all complete

## Your Mission
Delete the legacy bundle. Make the app 100% React with no `<script>` tags loading vanilla JS.

## Step-by-Step

### Step 1 — Replace public/index.html with a React entry
Edit [packages/web/public/index.html](packages/web/public/index.html):
- Strip all `<script src="/jobs/...">` tags and any vanilla JS imports.
- Replace with a minimal HTML shell that has `<div id="root"></div>` and loads `app.tsx` (mirror the structure of `packages/web/index.html` — verify it's the canonical Vite entry).
- The `/` route is already wired in React Router to `JobsPage`. After this edit, `/` is React-only.

### Step 2 — Delete the legacy builder bundle
```bash
git rm -r packages/web/public/builder/
```
This removes:
- The legacy [public/builder/index.html](packages/web/public/builder/index.html)
- All ~60 files in [public/builder/js/](packages/web/public/builder/js/)
- Any builder-local CSS that's already mirrored in `src/styles/builderStyles.css` (verify before deletion if unsure)

### Step 3 — Audit and remove `window.mediaTools` references
```bash
grep -rn "window.mediaTools" packages/web/src
```
After W1 and W2A–W2D, only test stubs or `.d.ts` type files should remain. Convert or delete each one. Delete `packages/web/src/types.window.d.ts` if it exists.

### Step 4 — Collapse createRoot calls
The legacy HTML triggered multiple `createRoot()` mounts (one per overlay modal). Now there's only [packages/web/src/app.tsx](packages/web/src/app.tsx). Verify it has a single `createRoot(document.getElementById("root")).render(<App />)`.

### Step 5 — Remove orphaned vendor scripts
Look in `packages/web/public/vendor/` for:
- `tailwind-3.4.17.js` (replaced by Tailwind v4 via Vite)
- `js-yaml.min.js` (replaced by the npm `js-yaml` import)
- `Sortable.min.js` (replaced by the npm import used in `useDragAndDrop`)

Delete any that are no longer referenced. Search for references first:
```bash
grep -rn "tailwind-3" packages/web
grep -rn "js-yaml.min" packages/web
grep -rn "Sortable.min" packages/web
```

### Step 6 — Strip dev-only inline preamble
The legacy `public/builder/index.html` had inline `<script>` tags for Vite's `@react-refresh` preamble and MSW bootstrap. Those are gone with Step 2. Verify no other HTML files have leftover dev-mode injection code.

## Verification Before You Push
```bash
yarn test run && yarn typecheck && yarn lint
yarn build
```
The `yarn build` catches missing-asset references from your deletions.

Manual smoke:
- `/` (jobs page) renders, jobs load, SSE works.
- `/builder` renders, every modal opens, drag-and-drop works on step cards.
- Browser console: zero errors.

## Commits (push each immediately)
1. `feat(jobs): React-only public/index.html entry`
2. `chore: delete legacy public/builder/ bundle (~60 files)`
3. `chore: remove window.mediaTools references and type stubs`
4. `chore: remove orphaned vendor scripts`

## Handoff
When all four commits are pushed and the pre-push gate is green: notify the orchestrator that W4A + W4B can start.

---

# WORKER W4A — Phase 4: Verification & Master Merge

**Model:** Sonnet · **Effort:** Medium · **Branch:** `react-migration` → `master` · **Prerequisite:** W3 complete · **Parallel with:** W4B

> **Naming:** this worker was labeled W4 in earlier docs; renamed to W4A so the parallel pair W4A + W4B matches the W2A–W2D pattern.

## Your Mission
Prove parity against W0c's reference YAML, run the full suite, then merge `react-migration` into `master`.

W4B is working in a separate worktree at the same time. **Coordination:** you and W4B share only one file in practice — [docs/react-migration-checklist.md](docs/react-migration-checklist.md). Each of you edits only your own row. Use `Edit` (not `Write`); `git pull --rebase` before push. W4B won't touch any of your source files or merge to master before you do.

## Step-by-Step

### Step 1 — Full test suite
```bash
yarn test run && yarn typecheck && yarn lint
```
All must pass.

### Step 2 — Storybook smoke
```bash
yarn storybook
```
Walk every new component story (every Wave B field, every modal, every picker). Click the controls, verify the component reacts. **Manual visual check only — no VRT.**

### Step 3 — Parity matrix
For every `<commandName>.yaml` fixture in `packages/web/tests/fixtures/parity/`:
1. Read the matching `<commandName>.input.json`.
2. In the new React `/builder`, create a step using that command, replay the input state from the JSON.
3. Click "Copy YAML" or open `YamlModal`.
4. Compare the new YAML output against the fixture YAML — byte-for-byte.
5. Any diff → bug. File an issue, fix or escalate, do not merge to master with parity drift.

### Step 4 — Audit and finalize the checklist
This is your single most important job — the prior migration failed because the checklist drifted from reality.

Read [docs/react-migration-checklist.md](docs/react-migration-checklist.md) row-by-row:
1. For every worker row marked ✅ Done, verify the corresponding code actually exists and works (random-sample 2-3 components per bundle, run their tests, manually exercise them in the dev server).
2. For every "Done" sub-task checkbox (e.g. `[x] BooleanField`), grep the codebase to confirm the file and its test exist:
   ```bash
   ls packages/web/src/components/BooleanField/
   yarn workspace @mux-magic/web test BooleanField
   ```
3. If you find a drift (checklist says Done, code says No), **STOP**. Reopen that worker's row as ⚠️ Blocked, document the gap, and notify the user. Do not merge to master until reality matches the checklist.
4. Once the entire table is verified accurate: mark all rows ✅ Done with completion dates. Add a final entry to "Progress Log": `W4A | <date> | checklist audited; all rows verified against code`.

### Step 5 — Merge to master
Follow the repo's merge convention (squash or merge commit — check with the user if unclear). Tag the commit:
```bash
git tag react-migration-complete
git push --tags
```

## Verification Before You Push
All of the above must pass. The parity matrix is the strictest gate — every command's YAML must match its fixture exactly.

## Commits (push each immediately)
1. `docs: react-migration complete; e2e deferred to phase 5`
2. (merge commit to master)

## Handoff
When master is merged and tagged: notify the user. W4B (E2E) is running in parallel and merges its worktree branch once your master merge lands.

---

# WORKER W4B — Phase 4: E2E Tests (Parallel with W4A)

**Model:** Sonnet · **Effort:** Medium · **Branch:** worktree off `react-migration` (post-W3 state) → merges to `master` after W4A · **Prerequisite:** W3 complete · **Parallel with:** W4A

> **Naming:** this worker was labeled W5 in earlier docs; renamed to W4B so the parallel pair W4A + W4B matches the W2A–W2D pattern. The next-phase cleanup worker is now W5 (formerly W6).

## Your Mission
Author Playwright e2e specs for the now-fully-React app, in parallel with W4A's verification + master merge.

## Worktree Setup

Create a dedicated worktree off the post-W3 react-migration state:

```bash
git worktree add ../Mux-Magic-e2e -b e2e-tests react-migration
cd ../Mux-Magic-e2e
yarn install
```

All your work happens in this worktree. The main checkout (where W4A is working) is untouched.

## Coordination with W4A

- **You only write files under [e2e/](e2e/).** Do not touch [packages/web/src/](packages/web/src/) — that's W4A's verification surface.
- **Do NOT modify [package.json](package.json) or [yarn.lock](yarn.lock).** Playwright is already installed. If you need a new dependency, **STOP** and notify the orchestrator — the install + yarn.lock change must be coordinated with W4A to avoid a merge conflict on master.
- **Checklist edits:** only your own W4B row. Use `Edit` tool, `git pull --rebase` before push.
- **You do not merge to master.** Wait for W4A to merge react-migration → master. Then rebase your `e2e-tests` branch onto master and merge when your specs pass.

## Step-by-Step

### Step 1 — Author specs in [e2e/](e2e/)

Use the existing Playwright config and directory. Cover the major user flows:

1. **Builder round-trip:** open `/builder` → create a sequence with at least one step of each major command type → copy YAML → reload → load YAML back → assert sequence matches.
2. **Jobs SSE:** open `/` (jobs page) → start a job → observe SSE streaming progress → confirm completion state.
3. **Modals:** LoadModal, YamlModal, CommandHelpModal, ApiRunModal, PromptModal, LookupModal, FileExplorerModal — each opens, accepts input, closes cleanly.
4. **Drag-and-drop:** reorder steps in a sequence; move steps between groups; assert order persists in YAML output.

### Step 2 — Assertion style

**No `toHaveScreenshot()` calls.** Use semantic assertions: `expect(page.getByRole(...)).toBeVisible()`, `toHaveText("literal")`, `toHaveCount(n)`. See Universal Rule #4 — no VRT under any framework.

### Step 3 — Mark yourself done in the checklist

Edit [docs/react-migration-checklist.md](docs/react-migration-checklist.md) — mark each spec checkbox as you complete it, push after each spec.

## Verification Before You Push

```bash
yarn test run && yarn typecheck && yarn lint
yarn e2e
```

## Commits

One commit per spec, push as you go (in your worktree, on the `e2e-tests` branch).

## Handoff

1. When all specs pass and W4A has merged react-migration → master:
   ```bash
   git fetch origin master
   git rebase origin/master
   yarn test run && yarn typecheck && yarn lint && yarn e2e   # re-verify after rebase
   git push origin e2e-tests
   ```
2. Open a PR `e2e-tests` → `master`, or merge directly per repo convention.
3. After merge, clean up the worktree:
   ```bash
   cd ..
   git worktree remove Mux-Magic-e2e
   git branch -d e2e-tests
   ```
4. Mark W4B ✅ Done in the checklist. Then notify the orchestrator that W5 (cleanup) can spawn whenever the user is ready.

---

## Checklist Template

W0 establishes this format in [docs/react-migration-checklist.md](docs/react-migration-checklist.md). All subsequent workers update their row.

```markdown
# React Migration Recovery Checklist

Last updated: <date> by <worker-id> (<model-name>)

## Worker Status

| Worker | Phase | Owner | Status | Started | Finished | Notes |
|---|---|---|---|---|---|---|
| Pre-W0 | — | (orchestrator) | ⬜ Not Started | — | — | AGENTS.md update; blocks W0a/b/c |
| W0a | 0 — Stale cleanup + checklist scaffold | <model> | ⬜ Not Started | — | — | Parallel with W0b, W0c |
| W0b | 0 — Audit existing state | <model> | ⬜ Not Started | — | — | Parallel with W0a, W0c |
| W0c | 0 — Parity reference capture | <model> | ⬜ Not Started | — | — | Time-critical: must run while legacy JS works |
| W1 | 1 — Wave B-0 RenderFields | <model> | ⬜ Not Started | — | — | Blocks W2A–W2D |
| W2A | 2 — Bundle A (primitives) | <model> | ⬜ Not Started | — | — | |
| W2B | 2 — Bundle B (enum/lang) | <model> | ⬜ Not Started | — | — | |
| W2C | 2 — Bundle C (arrays/json) | <model> | ⬜ Not Started | — | — | |
| W2D | 2 — Bundle D (composite) | <model> | ⬜ Not Started | — | — | DslRulesBuilder may escalate |
| W3 | 3 — Final Cleanup | <model> | ⬜ Not Started | — | — | Blocks on W2A+W2B+W2C+W2D+W2.5 |
| W4A | 4 — Verification & Master Merge | <model> | ⬜ Not Started | — | — | Parallel with W4B |
| W4B | 4 — E2E tests (worktree) | <model> | ⬜ Not Started | — | — | Parallel with W4A; merges to master after W4A |
| W5 | 5 — Parity-trap + code-smell + a11y cleanup | <model> | ⬜ Not Started | — | — | Runs after W4A + W4B both done. (Was W6 before rename.) |

**Status legend:** ⬜ Not Started · 🔄 In Progress · ✅ Done · ⚠️ Blocked · ❌ Failed

## Per-Worker Detail

### Pre-W0 — Orchestrator AGENTS.md Update
- [ ] AGENTS.md updated with no-snapshot and no-VRT rules
- [ ] `yarn lint` passes
- [ ] Commit pushed: `docs(agents): add no-snapshot and no-VRT rules`

### W0a — Stale Cleanup + Checklist Scaffold
- [ ] Step 1: Delete stale `.claude/worktrees/` directories
- [ ] Step 2: Delete stale local branches (after confirming no unpushed commits)
- [ ] Step 3: Create this checklist file with full scaffold

### W0b — Audit Existing State
- [ ] Step 1: Dev environment runs cleanly (or anomalies recorded)
- [ ] Step 2: Inspect partial component dirs — fill in findings below
- [ ] Step 3: Findings committed to checklist

**Phase 0 audit findings (W0b fills in):**
- `EnumField/`: <empty/stub/partial/wired — describe>
- `LanguageCodeField/`: <empty/stub/partial/wired — describe>
- `PathField/`: <empty/stub/partial/wired — describe>
- `NumberField/`: <empty/stub/partial/wired — describe>
- Dev env anomalies: <list>
- Other anomalies: <list anything else discovered>

### W0c — Parity Reference Capture
- [ ] Step 1: Dev server running with legacy `/builder`
- [ ] Step 2: YAML + input.json captured for every command in commands.js
- [ ] Step 3: Fixture count recorded in checklist

**Fixtures captured (W0c fills in):** `<N>` command fixtures in `packages/web/tests/fixtures/parity/`

### W1 — Phase 1: Wave B-0
- [ ] Step 1: commands.ts
- [ ] Step 2: buildParams.ts + tests
- [ ] Step 3: links.ts + fieldVisibility.ts
- [ ] Step 4: FieldLabel component
- [ ] Step 5: Real RenderFields dispatcher
- [ ] Step 6: BuilderPage drops dynamic JS import
- [ ] Step 7: yamlSerializer uses TS buildParams
- [ ] Step 8: __fixtures__/commands.ts frozen

### W2A — Bundle A: Primitives
- [ ] BooleanField (port + test + story + dispatcher wire-up)
- [ ] NumberField
- [ ] StringField

### W2B — Bundle B: Enum / Language
- [ ] EnumField
- [ ] LanguageCodeField
- [ ] LanguageCodesField

### W2C — Bundle C: Arrays + JSON
- [ ] StringArrayField
- [ ] NumberArrayField
- [ ] JsonField

### W2D — Bundle D: Composite (Heaviest)
- [ ] PathField
- [ ] NumberWithLookupField
- [ ] FolderMultiSelectField
- [ ] SubtitleRulesField
- [ ] step-output-picker port (used by PathField, NumberWithLookupField)
- [ ] DslRulesBuilder (may escalate — see below)

**DslRulesBuilder escalation status (W2D fills in):**
- Verdict: <mechanical / non-mechanical — reasoning>
- If non-mechanical: blocked / reassigned to Phase 2.5 (Sonnet High effort)

### W3 — Phase 3: Final Cleanup
- [ ] Step 1: React-only public/index.html
- [ ] Step 2: Delete public/builder/
- [ ] Step 3: Remove all window.mediaTools references
- [ ] Step 4: Collapse createRoot calls
- [ ] Step 5: Remove orphaned vendor scripts
- [ ] Step 6: Strip dev-only inline preamble

### W4A — Phase 4: Verification & Master Merge
- [ ] Full test suite green
- [ ] Storybook smoke walk
- [ ] Parity matrix — every command's YAML matches its W0 fixture byte-for-byte
- [ ] Master merge + tag `react-migration-complete`

### W4B — Phase 4: E2E (Parallel with W4A, worktree)
- [ ] Builder flow specs
- [ ] Jobs flow + SSE spec
- [ ] Modal specs
- [ ] Drag-and-drop spec

### W5 — Phase 5: Parity-trap + code-smell + a11y cleanup (formerly W6)
- [ ] Stream 1: parity quirks held back during port
- [ ] Stream 2: code-smell sweep (getIsX collisions, let+subscribe → lastValueFrom, one component per file)
- [ ] Stream 3: final a11y pass

## Progress Log

Workers append one line per push. Newest at the bottom.

```
W0 | 2026-05-10 | chore: remove stale .claude/worktrees and local branches
W0 | 2026-05-10 | test: capture parity reference YAML for all commands
W0 | 2026-05-10 | docs: add no-snapshot and no-VRT rules to AGENTS.md
W0 | 2026-05-10 | docs: re-baseline react-migration-checklist against audit findings
W1 | <date> | feat(commands): port COMMANDS to TS
...
```

## Open Questions / Blockers

(Workers add here when stuck. Never silently skip steps.)
```

---

## Appendix: Critical Files Reference

### Port targets (Phase 1 — W1)
- [packages/web/public/builder/js/commands.js](packages/web/public/builder/js/commands.js) → `packages/web/src/commands/commands.ts`
- [packages/web/public/builder/js/sequence-editor.js](packages/web/public/builder/js/sequence-editor.js) (`buildParams`) → `packages/web/src/commands/buildParams.ts`
- [packages/web/public/builder/js/util/field-visibility.js](packages/web/public/builder/js/util/field-visibility.js) → `packages/web/src/commands/fieldVisibility.ts`
- [packages/web/public/builder/js/fields/field-label.js](packages/web/public/builder/js/fields/field-label.js) → `packages/web/src/components/FieldLabel/FieldLabel.tsx`

### Port targets (Phase 2 — W2A–W2D)
- All files in [packages/web/public/builder/js/fields/](packages/web/public/builder/js/fields/) → `packages/web/src/components/<Field>/`
- [packages/web/public/builder/js/fields/step-output-picker.js](packages/web/public/builder/js/fields/step-output-picker.js) → W2D
- [packages/web/public/builder/js/components/dsl-rules-builder.js](packages/web/public/builder/js/components/dsl-rules-builder.js) → W2D

### Edit targets (Phase 1 — W1)
- [packages/web/src/jobs/yamlSerializer.ts](packages/web/src/jobs/yamlSerializer.ts) — drop `window.mediaTools` branch
- [packages/web/src/components/RenderFields/RenderFields.tsx](packages/web/src/components/RenderFields/RenderFields.tsx) — replace placeholder with real dispatcher
- [packages/web/src/pages/BuilderPage/BuilderPage.tsx](packages/web/src/pages/BuilderPage/BuilderPage.tsx) — drop dynamic JS import

### Delete targets (Phase 3 — W3)
- [packages/web/public/builder/](packages/web/public/builder/) (entire directory)
- [packages/web/public/index.html](packages/web/public/index.html) (rewrite, don't delete the path)
- `packages/web/public/vendor/*` (orphaned scripts)
